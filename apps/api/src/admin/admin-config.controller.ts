import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseEnumPipe,
  Injectable,
  Post,
  type OnModuleDestroy,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cifrar,
  conexoesCaidasPlataforma,
  contasDaPlataforma,
  configuracaoDoSistema,
  configuracaoSmtp,
  decifrar,
} from '@pente-fino/db';
import {
  avisoGeralSchema,
  configClubeOnlineSchema,
  configTesteSchema,
  type ConfigClubeOnline,
  FILA_WHATSAPP_SAIDA,
  CHAVES_MODELO_EMAIL,
  cupomSchema,
  lerCupons,
  type Cupom,
  type CupomNaTela,
  dataLocal,
  lerTabelasPreco,
  tabelaPrecosPlanosSchema,
  type TabelaPrecosPlanos,
  lerConfiguracaoPublica,
  lerModelosEmail,
  MODELOS_EMAIL,
  modeloPersonalizadoSchema,
  type ChaveModeloEmail,
  type ModeloEmailNaTela,
  smtpEntradaSchema,
  smtpGuardadoSchema,
  smtpParaTela,
  type ResultadoTesteSmtp,
  type SmtpEntrada,
  type SmtpGuardado,
  type SmtpNaTela,
  type ConfigTeste,
  type ConfiguracaoPublica,
  type SaudeDoSistema,
  type ExecucaoLimpezaNaTela,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { EmailsService } from '../emails/emails.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { Filas } from '../filas/filas.module.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { AdminAtual, AdminGuard, IpDaRequisicao, PapeisPlataforma } from './admin.guard.js';
import { BancoPlataforma } from './banco-plataforma.js';
import { enviarTesteSmtp, testarConexaoSmtp } from './smtp-teste.js';

const DIA_MS = 86_400_000;
const avisoOuNada = z.object({ aviso: avisoGeralSchema.nullable() });

/** Filas que a saúde do sistema acompanha (a de saída do WhatsApp é do worker; aqui só se lê). */
@Injectable()
export class SaudeService implements OnModuleDestroy {
  private saida?: Queue;

  constructor(
    @Inject(Filas) private readonly filas: Filas,
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  private filasLidas(): [string, Queue][] {
    this.saida ??= new Queue(FILA_WHATSAPP_SAIDA, { connection: { url: this.config.redisUrl } });
    return [
      ['E-mails', this.filas.emails],
      ['WhatsApp (entrada e rotinas)', this.filas.whatsappEntrada],
      ['WhatsApp (envio)', this.saida],
      ['Notificações no celular', this.filas.notificacoes],
      ['Eventos', this.filas.eventos],
    ];
  }

  async saude(): Promise<SaudeDoSistema> {
    const banco = await this.banco.prisma.$queryRaw`SELECT 1`.then(
      () => 'ok' as const,
      () => 'falha' as const,
    );
    const desde = Date.now() - DIA_MS;
    const filas: SaudeDoSistema['filas'] = [];
    const errosRecentes: SaudeDoSistema['errosRecentes'] = [];
    for (const [nome, fila] of this.filasLidas()) {
      const c = await fila.getJobCounts('waiting', 'delayed', 'active', 'failed');
      filas.push({
        fila: nome,
        esperando: c.waiting ?? 0,
        agendados: c.delayed ?? 0,
        ativos: c.active ?? 0,
        falhas: c.failed ?? 0,
      });
      for (const j of await fila.getFailed(0, 30))
        if ((j.finishedOn ?? 0) >= desde)
          errosRecentes.push({
            fila: nome,
            tipo: j.name,
            motivo: (j.failedReason ?? 'sem motivo').slice(0, 200),
            quando: new Date(j.finishedOn!).toISOString(),
          });
    }
    const caidas = await conexoesCaidasPlataforma(this.banco.prisma);
    const limpeza = await this.banco.prisma.execucaoLimpeza.findMany({
      orderBy: { iniciadaEm: 'desc' },
      take: 7,
    });
    return {
      banco,
      filas,
      conexoesCaidas: caidas.map((x) => ({
        contaId: x.conta_id,
        conta: x.conta,
        unidade: x.unidade,
        numero: x.numero,
        caiuEm: x.caiu_em.toISOString(),
      })),
      errosRecentes: errosRecentes.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 50),
      limpeza: limpeza.map((e) => ({
        iniciadaEm: e.iniciadaEm.toISOString(),
        terminadaEm: e.terminadaEm?.toISOString() ?? null,
        apagados: e.apagados as ExecucaoLimpezaNaTela['apagados'],
        retidas: e.retidas as ExecucaoLimpezaNaTela['retidas'],
        erro: e.erro,
      })),
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.saida?.close();
  }
}

@ApiTags('Administração do sistema')
@ApiBearerAuth()
@Controller('admin')
@Publico()
@UseGuards(AdminGuard)
@PapeisPlataforma('admin')
export class AdminConfigController {
  constructor(
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(SaudeService) private readonly saudeServico: SaudeService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(Filas) private readonly filas: Filas,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(PrecosService) private readonly precos: PrecosService,
  ) {}

  private async gravar(
    chave: string,
    valor: unknown,
    a: AdminAutenticado,
    ip: string | null,
    /** O que vai para a auditoria quando o valor tem segredo. */
    paraAuditoria?: object,
  ) {
    const db = this.banco.prisma;
    const antes = await db.configuracaoPlataforma.findUnique({ where: { chave } });
    // Sem valor (tirar o aviso): grava vazio, que a leitura trata como "nenhum".
    const json = (valor ?? {}) as object;
    await db.configuracaoPlataforma.upsert({
      where: { chave },
      create: { chave, valor: json, atualizadoPorId: a.id },
      update: { valor: json, atualizadoEm: new Date(), atualizadoPorId: a.id },
    });
    if (chave === 'modelos_email') this.emails.esquecerModelos();
    await this.auth.auditar({
      usuarioId: a.id,
      acao: `configurar_${chave}`,
      antes: antes && !paraAuditoria ? { valor: antes.valor } : null,
      depois: { valor: paraAuditoria ?? valor },
      ip,
    });
  }

  @Get('configuracoes')
  @ApiOperation({ summary: 'Configurações do sistema: aviso geral e teste grátis' })
  async ler(): Promise<ConfiguracaoPublica> {
    return lerConfiguracaoPublica(await configuracaoDoSistema(this.banco.prisma));
  }

  @Put('configuracoes/aviso-geral')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aviso para todas as contas (com início e fim) ou tirar o aviso' })
  async aviso(
    @Corpo(avisoOuNada) d: z.infer<typeof avisoOuNada>,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    await this.gravar('aviso_geral', d.aviso, a, ip);
  }

  @Put('configuracoes/teste')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dias de teste grátis e versão dos termos em vigor' })
  async teste(
    @Corpo(configTesteSchema) d: ConfigTeste,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    await this.gravar('teste', d, a, ip);
  }

  @Put('configuracoes/clube-online')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Taxa da plataforma sobre o clube online (vale para assinaturas novas)',
  })
  async clubeOnline(
    @Corpo(configClubeOnlineSchema) d: ConfigClubeOnline,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    await this.gravar('clube_online', d, a, ip);
  }

  @Get('configuracoes/smtp')
  @ApiOperation({ summary: 'SMTP configurado (sem a senha); null = vale o do .env' })
  async smtp(): Promise<{ smtp: SmtpNaTela | null }> {
    return { smtp: smtpParaTela(await configuracaoSmtp(this.banco.prisma)) };
  }

  @Put('configuracoes/smtp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Salvar o SMTP (senha cifrada; em branco = manter a guardada)' })
  async salvarSmtp(
    @Corpo(smtpEntradaSchema) d: SmtpEntrada,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const atual = smtpGuardadoSchema.safeParse(await configuracaoSmtp(this.banco.prisma));
    const { senha, ...resto } = d;
    const senhaCifrada =
      senha === null
        ? atual.success
          ? atual.data.senhaCifrada
          : null
        : senha === ''
          ? null
          : cifrar(senha, this.config.plataforma.chave);
    // A senha nunca vai para a auditoria (nem cifrada).
    await this.gravar('smtp', { ...resto, senhaCifrada }, a, ip, {
      ...resto,
      senha: senha === null ? 'mantida' : 'trocada',
    });
  }

  @Delete('configuracoes/smtp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Voltar a usar o SMTP do .env' })
  async limparSmtp(
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    await this.gravar('smtp', null, a, ip, { voltarAoEnv: true });
  }

  /** Senha guardada, decifrada; erro claro se a chave mudou. */
  private senhaGuardada(g: SmtpGuardado): string {
    if (!g.senhaCifrada) return '';
    try {
      return decifrar(g.senhaCifrada, this.config.plataforma.chave);
    } catch {
      throw Erros.conflito(
        'A senha guardada não abre com a chave atual (PLATAFORMA_CHAVE mudou?). Salve a senha de novo.',
      );
    }
  }

  @Post('configuracoes/smtp/conexao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Testar a conexão com os dados da tela (antes de salvar); senha null = a guardada',
  })
  async testarConexao(@Corpo(smtpEntradaSchema) d: SmtpEntrada): Promise<ResultadoTesteSmtp> {
    let senha = d.senha ?? '';
    if (d.senha === null) {
      const g = smtpGuardadoSchema.safeParse(await configuracaoSmtp(this.banco.prisma));
      senha = g.success ? this.senhaGuardada(g.data) : '';
    }
    return testarConexaoSmtp({ ...d, senha });
  }

  @Post('configuracoes/smtp/teste')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mandar agora um e-mail de teste para quem está na administração (SMTP salvo)',
  })
  async testarSmtp(@AdminAtual() a: AdminAutenticado): Promise<ResultadoTesteSmtp> {
    const g = smtpGuardadoSchema.safeParse(await configuracaoSmtp(this.banco.prisma));
    const env = process.env;
    const dados = g.success
      ? { ...g.data, senha: this.senhaGuardada(g.data) }
      : {
          host: env.SMTP_HOST ?? 'localhost',
          porta: Number(env.SMTP_PORT) || 587,
          seguro: env.SMTP_SECURE === 'true',
          usuario: env.SMTP_USER ?? '',
          senha: env.SMTP_PASSWORD ?? '',
          remetente: env.EMAIL_FROM ?? 'Pente Fino <nao-responda@pentefino.dev>',
        };
    return enviarTesteSmtp(dados, {
      de: dados.remetente,
      para: a.email,
      assunto: 'E-mail de teste do Pente Fino',
      texto: `Oi, ${a.nome}. Se este e-mail chegou, o envio está funcionando (${g.success ? `SMTP ${g.data.host}` : 'SMTP do .env'}).`,
    });
  }

  @Get('configuracoes/modelos-email')
  @ApiOperation({ summary: 'Modelos de e-mail: variáveis, texto padrão e o personalizado' })
  async modelos(): Promise<ModeloEmailNaTela[]> {
    const guardados = lerModelosEmail(await this.valor('modelos_email'));
    return CHAVES_MODELO_EMAIL.map((chave) => ({
      chave,
      ...MODELOS_EMAIL[chave],
      personalizado: guardados[chave] ?? null,
    }));
  }

  @Put('configuracoes/modelos-email/:chave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Personalizar um modelo (só as variáveis que ele tem)' })
  async salvarModelo(
    @Param('chave', new ParseEnumPipe(CHAVES_MODELO_EMAIL)) chave: ChaveModeloEmail,
    @Body() corpo: unknown,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const r = modeloPersonalizadoSchema(chave).safeParse(corpo);
    if (!r.success)
      throw Erros.validacao(
        r.error.issues.map((i) => ({ campo: i.path.join('.') || 'corpo', mensagem: i.message })),
      );
    const guardados = lerModelosEmail(await this.valor('modelos_email'));
    await this.gravar('modelos_email', { ...guardados, [chave]: r.data }, a, ip);
  }

  @Delete('configuracoes/modelos-email/:chave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Voltar o modelo ao texto padrão' })
  async padraoModelo(
    @Param('chave', new ParseEnumPipe(CHAVES_MODELO_EMAIL)) chave: ChaveModeloEmail,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const guardados = lerModelosEmail(await this.valor('modelos_email'));
    delete guardados[chave];
    await this.gravar('modelos_email', guardados, a, ip);
  }

  /** Valor guardado de uma chave (cru). */
  private async valor(chave: string): Promise<unknown> {
    return (
      (await this.banco.prisma.configuracaoPlataforma.findUnique({ where: { chave } }))?.valor ??
      null
    );
  }

  @Get('configuracoes/precos')
  @ApiOperation({ summary: 'Tabelas de preço dos planos, em ordem de vigência' })
  async tabelasPreco(): Promise<{ tabelas: TabelaPrecosPlanos[]; hoje: string }> {
    return { tabelas: await this.precos.tabelas(), hoje: dataLocal(new Date()) };
  }

  @Put('configuracoes/precos')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Cadastrar uma tabela que vale a partir de hoje ou de uma data futura (quem já assinou não muda)',
  })
  async salvarTabela(
    @Corpo(tabelaPrecosPlanosSchema) t: TabelaPrecosPlanos,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const hoje = dataLocal(new Date());
    if (t.desde < hoje)
      throw Erros.validacao([
        { campo: 'desde', mensagem: 'A tabela vale a partir de hoje ou de uma data futura.' },
      ]);
    const guardadas = lerTabelasPreco(await this.valor('precos')).slice(1);
    const vigentes = guardadas.filter((x) => x.desde < hoje && x.desde !== t.desde);
    const futuras = guardadas.filter((x) => x.desde >= hoje && x.desde !== t.desde);
    await this.gravar('precos', [...vigentes, ...futuras, t], a, ip);
    this.precos.esquecer();
  }

  @Delete('configuracoes/precos/:desde')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desistir de uma tabela que ainda não começou a valer' })
  async removerTabela(
    @Param('desde') desde: string,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    if (!(desde > dataLocal(new Date())))
      throw Erros.conflito('Só dá para desistir de uma tabela que ainda não começou a valer.');
    const guardadas = lerTabelasPreco(await this.valor('precos')).slice(1);
    await this.gravar(
      'precos',
      guardadas.filter((x) => x.desde !== desde),
      a,
      ip,
    );
    this.precos.esquecer();
  }

  @Get('configuracoes/cupons')
  @ApiOperation({ summary: 'Cupons de desconto, com quantas contas já usaram' })
  async cupons(): Promise<CupomNaTela[]> {
    const contas = await contasDaPlataforma(this.banco.prisma);
    return lerCupons(await this.valor('cupons')).map((c) => ({
      ...c,
      // A vaga conta quando a conta paga (igual a cupom_para_cadastro()).
      usados: contas.filter((x) => x.cupom?.toUpperCase() === c.codigo && x.status === 'ativa')
        .length,
    }));
  }

  @Put('configuracoes/cupons')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Criar ou mudar um cupom (pelo código); desativar não tira de quem já usa',
  })
  async salvarCupom(
    @Corpo(cupomSchema) c: Cupom,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const outros = lerCupons(await this.valor('cupons')).filter((x) => x.codigo !== c.codigo);
    await this.gravar('cupons', [...outros, c], a, ip);
  }

  @Get('saude')
  @ApiOperation({ summary: 'Saúde do sistema: filas, WhatsApp que caiu e erros recentes' })
  saude(): Promise<SaudeDoSistema> {
    return this.saudeServico.saude();
  }
}

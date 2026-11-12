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
  notasFiscaisPlataforma,
  ultimaNotaEmitidaPlataforma,
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
  lerConfigNotaFiscal,
  descartarEmailSchema,
  EMAILS_CRITICOS,
  ipInterno,
  mascararEmail,
  type FalhaDeEmail,
  type TrabalhoEmail,
  BATIMENTO_WORKER_MAX_S,
  CHAVE_BATIMENTO_WORKER,
  CHAVE_ROTINAS_WORKER,
  ROTINAS_WORKER,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { EmailsService } from '../emails/emails.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { Filas, REDIS } from '../filas/filas.module.js';
import { WebhooksRecusados } from '../comum/webhooks-recusados.js';
import type { Redis } from 'ioredis';
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
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(WebhooksRecusados) private readonly recusas: WebhooksRecusados,
  ) {}

  /** V3: último batimento do worker e última execução de cada rotina agendada. */
  private async worker(agora = Date.now()): Promise<Pick<SaudeDoSistema, 'worker' | 'rotinas'>> {
    let batimento: string | null = null;
    let execucoes: Record<string, string> = {};
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      batimento = await this.redis.get(CHAVE_BATIMENTO_WORKER);
      execucoes = await this.redis.hgetall(CHAVE_ROTINAS_WORKER);
    } catch {
      // Sem Redis, o worker também não anda: aparece como parado.
    }
    const parado = !batimento || agora - Date.parse(batimento) > BATIMENTO_WORKER_MAX_S * 1000;
    const rotinas = ROTINAS_WORKER.map((r) => {
      let ultima: string | null = null;
      let resultado: string | null = null;
      try {
        const e = JSON.parse(execucoes[r.rotina] ?? 'null') as {
          quando?: string;
          resultado?: string;
        } | null;
        ultima = e?.quando ?? null;
        resultado = e?.resultado ?? null;
      } catch {
        // Valor estranho no Redis: trata como nunca rodou.
      }
      const atrasada = !!ultima && agora - Date.parse(ultima) > r.prazoMin * 60_000;
      return { rotina: r.rotina, nome: r.nome, ultima, resultado, atrasada };
    });
    return { worker: { ultimoBatimento: batimento, parado }, rotinas };
  }

  /** W4: segredo de webhook curto (menos de 32 caracteres) vira aviso, sem derrubar a API. */
  private segredosCurtos(): string[] {
    const curtos: string[] = [];
    if (this.config.cobranca.webhookToken && this.config.cobranca.webhookToken.length < 32)
      curtos.push('ASAAS_WEBHOOK_TOKEN');
    if (this.config.whatsapp.webhookSegredo.length < 32) curtos.push('WHATSAPP_WEBHOOK_SEGREDO');
    return curtos;
  }

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
    const notasFiscais = await this.notasFiscais();
    const ipsInternos = await this.ipsInternos();
    return {
      banco,
      filas,
      notasFiscais,
      ipsInternos,
      ...(await this.worker()),
      webhooksRecusados: await this.recusas.resumo(),
      segredosCurtos: this.segredosCurtos(),
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

  /** Admin R9: acessos à administração dos últimos 7 dias que chegaram com IP interno. */
  private async ipsInternos(): Promise<SaudeDoSistema['ipsInternos']> {
    const eventos = await this.banco.prisma.auditoriaPlataforma.findMany({
      where: { criadoEm: { gte: new Date(Date.now() - 7 * DIA_MS) }, ip: { not: null } },
      select: { ip: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
      take: 2000,
    });
    const internos = eventos.filter((e) => ipInterno(e.ip));
    return {
      acessos: internos.length,
      ultimo: internos[0]?.criadoEm.toISOString() ?? null,
    };
  }

  /**
   * Admin R7: e-mails que falharam na fila, sem o conteúdo e com o destinatário mascarado.
   * `desde` = só os que falharam depois (para o "Precisa de atenção").
   */
  async falhasDeEmail(desde?: number): Promise<FalhaDeEmail[]> {
    const jobs = await this.filas.emails.getFailed(0, 199);
    return jobs
      .filter((j) => !desde || (j.finishedOn ?? 0) >= desde)
      .map((j) => {
        const e = (j.data ?? {}) as Partial<TrabalhoEmail>;
        const chave = e.modelo as ChaveModeloEmail | undefined;
        return {
          id: String(j.id),
          quando: new Date(j.finishedOn ?? j.timestamp).toISOString(),
          para: mascararEmail(e.para ?? ''),
          modelo: chave && MODELOS_EMAIL[chave] ? MODELOS_EMAIL[chave].nome : null,
          assunto: (e.assunto ?? '').slice(0, 200),
          motivo: (j.failedReason ?? 'Sem motivo informado').slice(0, 300),
          tentativas: j.attemptsMade,
          critico: !!chave && EMAILS_CRITICOS.includes(chave),
        };
      })
      .sort((a, b) => b.quando.localeCompare(a.quando));
  }

  /** Reenvia (volta para a fila com as tentativas zeradas); devolve o destinatário mascarado. */
  async reenviarEmail(id: string): Promise<{ para: string; modelo: string | null }> {
    const j = await this.filas.emails.getJob(id);
    if (!j || !(await j.isFailed()))
      throw Erros.naoEncontrado('Este e-mail não está mais entre as falhas.');
    const e = (j.data ?? {}) as Partial<TrabalhoEmail>;
    await j.retry('failed', { resetAttemptsMade: true });
    return { para: mascararEmail(e.para ?? ''), modelo: e.modelo ?? null };
  }

  /** Tira das falhas sem enviar (o motivo vai para a auditoria). */
  async descartarEmail(id: string): Promise<{ para: string; modelo: string | null }> {
    const j = await this.filas.emails.getJob(id);
    if (!j || !(await j.isFailed()))
      throw Erros.naoEncontrado('Este e-mail não está mais entre as falhas.');
    const e = (j.data ?? {}) as Partial<TrabalhoEmail>;
    await j.remove();
    return { para: mascararEmail(e.para ?? ''), modelo: e.modelo ?? null };
  }

  /** Nota fiscal das mensalidades: ligada?, a última emitida e as que não saíram em 30 dias. */
  private async notasFiscais(): Promise<SaudeDoSistema['notasFiscais']> {
    const db = this.banco.prisma;
    const config = await db.configuracaoPlataforma.findUnique({ where: { chave: 'nota_fiscal' } });
    const recentes = await notasFiscaisPlataforma(db, new Date(Date.now() - 30 * DIA_MS));
    const ultima = await ultimaNotaEmitidaPlataforma(db);
    return {
      ativa: lerConfigNotaFiscal(config?.valor).ativa,
      ultimaEmitida: ultima
        ? { conta: ultima.conta, numero: ultima.numero, quando: ultima.emitida_em.toISOString() }
        : null,
      erros: recentes
        .filter((n) => n.status === 'erro')
        .slice(0, 20)
        .map((n) => ({
          conta: n.conta,
          mensagem: n.mensagem ?? 'Sem detalhe do Asaas.',
          quando: n.atualizado_em.toISOString(),
        })),
      aCaminho: recentes.filter((n) => n.status === 'agendada' || n.status === 'enviada').length,
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

  @Get('saude/emails')
  @PapeisPlataforma('admin', 'suporte')
  @ApiOperation({ summary: 'E-mails que não saíram (destinatário mascarado, motivo do SMTP)' })
  emailsFalhos(): Promise<FalhaDeEmail[]> {
    return this.saudeServico.falhasDeEmail();
  }

  @Post('saude/emails/:id/reenviar')
  @PapeisPlataforma('admin', 'suporte')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reenviar um e-mail que falhou' })
  async reenviarEmail(
    @Param('id') id: string,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const e = await this.saudeServico.reenviarEmail(id.slice(0, 64));
    await this.auth.auditar({ usuarioId: a.id, acao: 'reenviar_email', depois: e, ip });
  }

  @Post('saude/emails/:id/descartar')
  @PapeisPlataforma('admin', 'suporte')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar um e-mail que falhou, com o motivo' })
  async descartarEmail(
    @Param('id') id: string,
    @Corpo(descartarEmailSchema) d: z.infer<typeof descartarEmailSchema>,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const e = await this.saudeServico.descartarEmail(id.slice(0, 64));
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'descartar_email',
      depois: e,
      motivo: d.motivo,
      ip,
    });
  }

  @Get('saude')
  @PapeisPlataforma('admin', 'suporte')
  @ApiOperation({ summary: 'Saúde do sistema: filas, WhatsApp que caiu e erros recentes' })
  saude(): Promise<SaudeDoSistema> {
    return this.saudeServico.saude();
  }
}

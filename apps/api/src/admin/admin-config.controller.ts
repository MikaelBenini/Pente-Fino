import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
  configuracaoDoSistema,
  configuracaoSmtp,
  decifrar,
} from '@pente-fino/db';
import {
  avisoGeralSchema,
  configTesteSchema,
  FILA_WHATSAPP_SAIDA,
  lerConfiguracaoPublica,
  smtpEntradaSchema,
  smtpGuardadoSchema,
  smtpParaTela,
  type SmtpEntrada,
  type SmtpNaTela,
  type ConfigTeste,
  type ConfiguracaoPublica,
  type SaudeDoSistema,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { Filas } from '../filas/filas.module.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { AdminAtual, AdminGuard, IpDaRequisicao, PapeisPlataforma } from './admin.guard.js';
import { BancoPlataforma } from './banco-plataforma.js';

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

  @Post('configuracoes/smtp/teste')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Mandar um e-mail de teste para quem está na administração' })
  async testarSmtp(
    @AdminAtual() a: AdminAutenticado,
  ): Promise<{ para: string; via: 'administracao' | 'env' }> {
    const g = smtpGuardadoSchema.safeParse(await configuracaoSmtp(this.banco.prisma));
    // Confere aqui se a senha guardada decifra: se não, o worker cairia no .env sem avisar.
    if (g.success && g.data.senhaCifrada) {
      try {
        decifrar(g.data.senhaCifrada, this.config.plataforma.chave);
      } catch {
        throw Erros.conflito(
          'A senha guardada não abre com a chave atual (PLATAFORMA_CHAVE mudou?). Salve a senha de novo.',
        );
      }
    }
    await this.filas.emails.add('teste_smtp', {
      para: a.email,
      assunto: 'E-mail de teste do Pente Fino',
      texto: `Oi, ${a.nome}. Se este e-mail chegou, o envio está funcionando (${g.success ? `SMTP ${g.data.host}` : 'SMTP do .env'}).`,
    });
    return { para: a.email, via: g.success ? 'administracao' : 'env' };
  }

  @Get('saude')
  @ApiOperation({ summary: 'Saúde do sistema: filas, WhatsApp que caiu e erros recentes' })
  saude(): Promise<SaudeDoSistema> {
    return this.saudeServico.saude();
  }
}

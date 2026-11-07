import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  type OnModuleDestroy,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { conexoesCaidasPlataforma, configuracaoDoSistema } from '@pente-fino/db';
import {
  avisoGeralSchema,
  configTesteSchema,
  FILA_WHATSAPP_SAIDA,
  lerConfiguracaoPublica,
  type ConfigTeste,
  type ConfiguracaoPublica,
  type SaudeDoSistema,
} from '@pente-fino/shared';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { Publico } from '../auth/decoradores.js';
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
  ) {}

  private async gravar(chave: string, valor: unknown, a: AdminAutenticado, ip: string | null) {
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
      antes: antes ? { valor: antes.valor } : null,
      depois: { valor },
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

  @Get('saude')
  @ApiOperation({ summary: 'Saúde do sistema: filas, WhatsApp que caiu e erros recentes' })
  saude(): Promise<SaudeDoSistema> {
    return this.saudeServico.saude();
  }
}

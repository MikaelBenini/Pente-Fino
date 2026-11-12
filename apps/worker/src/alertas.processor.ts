// Admin F3: alertas para a equipe da plataforma, de hora em hora (junto, o F1d: e-mail de ajuda
// para a barbearia parada há 3 dias na mesma etapa do funil). Junta os dados com a conexão
// da administração (a mesma da API), a regra do shared decide os alertas, cada alerta sai uma
// vez só e cada pessoa recebe um e-mail só com os tipos que escolheu.
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  contasDaPlataforma,
  criarPrisma,
  equipeParaAlertas,
  faturasDaPlataforma,
  fichaDaContaPlataforma,
  funilDasContas,
  guardarAlertasNovos,
  notasFiscaisPlataforma,
  whatsappCaidoDaPlataforma,
  type PrismaClient,
} from '@pente-fino/db';
import {
  decidirEtapaParada,
  detectarAlertasEquipe,
  emailDeAlertasEquipe,
  emailDoPasso,
  emailPronto,
  etapaAtualDoFunil,
  lerModelosEmail,
  FILA_ALERTAS_EQUIPE,
  FILA_EMAILS,
  lerCupons,
  TIPOS_ALERTA_EQUIPE,
  type DadosAlertasEquipe,
  type TipoAlertaEquipe,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import { Queue, Worker } from 'bullmq';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

export interface DependenciasAlertas {
  /** Conexão da administração (usuário de banco da plataforma). */
  prisma: PrismaClient;
  appUrl: string;
  emailsFalhos: () => Promise<DadosAlertasEquipe['emailsFalhos']>;
  enviarEmail: (e: TrabalhoEmail) => Promise<unknown>;
  agora?: Date;
}

const dia = (d: Date) => d.toISOString().slice(0, 10);

/** Junta os dados, decide os alertas novos e manda um e-mail por pessoa. Devolve um resumo. */
export async function executarAlertasEquipe(d: DependenciasAlertas): Promise<string> {
  const agora = d.agora ?? new Date();
  const [contas, faturas, whatsappCaido, notas, cuponsJson, emailsFalhos] = await Promise.all([
    contasDaPlataforma(d.prisma),
    faturasDaPlataforma(d.prisma),
    whatsappCaidoDaPlataforma(d.prisma),
    notasFiscaisPlataforma(d.prisma, new Date(agora.getTime() - 7 * 86_400_000)),
    d.prisma.configuracaoPlataforma.findUnique({ where: { chave: 'cupons' } }),
    d.emailsFalhos(),
  ]);
  const alertas = detectarAlertasEquipe(
    {
      contas: contas.map((c) => ({
        id: c.id,
        nome: c.nome,
        status: c.status,
        criadaEm: c.criado_em.toISOString(),
        testeAte: c.teste_ate?.toISOString() ?? null,
        interna: c.interna,
        ultimaFechadaEm: c.ultima_fechada_em?.toISOString() ?? null,
      })),
      faturas: faturas.map((f) => ({
        contaId: f.conta_id,
        status: f.status,
        vencimento: dia(f.vencimento),
        valor: f.valor,
      })),
      whatsappCaido,
      emailsFalhos,
      notasComErro: notas
        .filter((n) => n.status === 'erro')
        .map((n) => ({
          conta: n.conta,
          numero: n.numero,
          mensagem: n.mensagem,
          quando: n.atualizado_em.toISOString(),
        })),
      // A vaga conta quando a conta paga (igual à tela de cupons e a cupom_para_cadastro()).
      cupons: lerCupons(cuponsJson?.valor ?? null).map((c) => ({
        codigo: c.codigo,
        vagas: c.vagas ?? null,
        usados: contas.filter((x) => x.cupom?.toUpperCase() === c.codigo && x.status === 'ativa')
          .length,
      })),
    },
    agora,
  );
  const novos = await guardarAlertasNovos(d.prisma, alertas);
  if (novos.length === 0) return 'alertas: nada novo';
  const equipe = await equipeParaAlertas(d.prisma);
  let enviados = 0;
  for (const p of equipe) {
    const escolhidos = p.alertas.filter((t): t is TipoAlertaEquipe =>
      (TIPOS_ALERTA_EQUIPE as readonly string[]).includes(t),
    );
    const email = emailDeAlertasEquipe(novos, escolhidos, `${d.appUrl}/admin`);
    if (!email) continue;
    await d.enviarEmail({ para: p.email, ...email, modelo: 'alertas_equipe' });
    enviados++;
  }
  return `alertas: ${novos.length} novo(s), ${enviados} e-mail(s)`;
}

/** Hora em São Paulo (0 a 23). */
const horaLocal = (d: Date) =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(d),
  );

/**
 * Admin F1d: guarda a etapa do funil de cada conta e, para a que está parada há 3 dias na mesma
 * etapa, manda aos donos o e-mail "Ajuda com o próximo passo" (modelo etapa_parada), uma vez por
 * etapa. E-mail só das 9 h às 20 h: fora disso, a conta espera a próxima rodada.
 */
export async function executarAvisosDeEtapa(
  d: Omit<DependenciasAlertas, 'emailsFalhos'>,
): Promise<string> {
  const agora = d.agora ?? new Date();
  const comercial = horaLocal(agora) >= 9 && horaLocal(agora) < 20;
  const [funil, contas, guardadas, modelosJson] = await Promise.all([
    funilDasContas(d.prisma),
    contasDaPlataforma(d.prisma),
    d.prisma.funilEtapaConta.findMany(),
    d.prisma.configuracaoPlataforma.findUnique({ where: { chave: 'modelos_email' } }),
  ]);
  const porId = new Map(contas.map((c) => [c.id, c]));
  const guardadaDe = new Map(guardadas.map((g) => [g.contaId, g]));
  const modelos = lerModelosEmail(modelosJson?.valor ?? null);
  let guardadasAgora = 0;
  let avisadas = 0;
  for (const f of funil) {
    const c = porId.get(f.id);
    if (!c) continue;
    const g = guardadaDe.get(f.id);
    const decisao = decidirEtapaParada({
      etapa: etapaAtualDoFunil(f),
      guardada: g
        ? {
            etapa: g.etapa,
            desde: g.desde.toISOString(),
            avisadoEm: g.avisadoEm?.toISOString() ?? null,
          }
        : null,
      status: c.status,
      interna: c.interna,
      plano: c.plano,
      agora,
    });
    if (decisao.acao === 'guardar') {
      await d.prisma.funilEtapaConta.upsert({
        where: { contaId: f.id },
        create: { contaId: f.id, etapa: decisao.etapa, desde: agora },
        update: { etapa: decisao.etapa, desde: agora, avisadoEm: null },
      });
      guardadasAgora++;
    } else if (decisao.acao === 'avisar' && comercial) {
      const ficha = (await fichaDaContaPlataforma(d.prisma, f.id)) as {
        donos?: { nome: string; email: string }[];
      } | null;
      const { link, ...vars } = emailDoPasso(decisao.passo, d.appUrl);
      for (const dono of ficha?.donos ?? []) {
        await d.enviarEmail(
          emailPronto(
            dono.email,
            'etapa_parada',
            modelos,
            { nome: dono.nome.split(' ')[0] ?? dono.nome, conta: c.nome, ...vars },
            link,
            { site: d.appUrl },
          ),
        );
      }
      await d.prisma.funilEtapaConta.update({
        where: { contaId: f.id },
        data: { avisadoEm: agora },
      });
      avisadas++;
    }
  }
  return `etapas: ${guardadasAgora} guardada(s), ${avisadas} conta(s) avisada(s)`;
}

@Injectable()
export class AlertasProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('AlertasEquipe');
  private fila?: Queue;
  private emails?: Queue<TrabalhoEmail>;
  private worker?: Worker;
  private prisma?: PrismaClient;

  constructor(@Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker) {}

  onModuleInit(): void {
    if (!this.config.DATABASE_PLATAFORMA_URL) {
      this.logger.warn('Sem DATABASE_PLATAFORMA_URL: os alertas da equipe ficam desligados.');
      return;
    }
    const prisma = criarPrisma(this.config.DATABASE_PLATAFORMA_URL);
    this.prisma = prisma;
    const connection = { url: this.config.REDIS_URL };
    this.fila = new Queue(FILA_ALERTAS_EQUIPE, {
      connection,
      defaultJobOptions: { removeOnComplete: { count: 48 }, removeOnFail: { count: 48 } },
    });
    const emails = new Queue<TrabalhoEmail>(FILA_EMAILS, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
    this.emails = emails;
    void this.fila
      .upsertJobScheduler(
        'alertas-de-hora-em-hora',
        { pattern: '5 * * * *', tz: 'America/Sao_Paulo' },
        { name: 'alertas', data: {} },
      )
      .catch((e: Error) => this.logger.error(`Agendar os alertas: ${e.message}`));
    this.worker = new Worker(
      FILA_ALERTAS_EQUIPE,
      async () => {
        const etapas = await executarAvisosDeEtapa({
          prisma,
          appUrl: this.config.APP_URL,
          enviarEmail: (e) => emails.add('etapa_parada', e),
        });
        const alertas = await executarAlertasEquipe({
          prisma,
          appUrl: this.config.APP_URL,
          enviarEmail: (e) => emails.add('alertas_equipe', e),
          emailsFalhos: async () =>
            (await emails.getFailed(0, 199)).map((j) => ({
              id: String(j.id),
              assunto: String((j.data as Partial<TrabalhoEmail>)?.assunto ?? '').slice(0, 120),
              quando: new Date(j.finishedOn ?? j.timestamp).toISOString(),
            })),
        });
        return `${alertas} · ${etapas}`;
      },
      { connection, concurrency: 1 },
    );
    this.worker.on('completed', (_j, r) => this.logger.log(String(r)));
    this.worker.on('failed', (_j, e) => this.logger.error(`Alertas da equipe: ${e.message}`));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.fila?.close();
    await this.emails?.close();
    await this.prisma?.$disconnect();
  }
}

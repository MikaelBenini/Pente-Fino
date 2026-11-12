// Admin F3: alertas para a equipe da plataforma, de hora em hora. Junta os dados com a conexão
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
  guardarAlertasNovos,
  notasFiscaisPlataforma,
  whatsappCaidoDaPlataforma,
  type PrismaClient,
} from '@pente-fino/db';
import {
  detectarAlertasEquipe,
  emailDeAlertasEquipe,
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
      () =>
        executarAlertasEquipe({
          prisma,
          appUrl: this.config.APP_URL,
          enviarEmail: (e) => emails.add('alertas_equipe', e),
          emailsFalhos: async () =>
            (await emails.getFailed(0, 199)).map((j) => ({
              id: String(j.id),
              assunto: String((j.data as Partial<TrabalhoEmail>)?.assunto ?? '').slice(0, 120),
              quando: new Date(j.finishedOn ?? j.timestamp).toISOString(),
            })),
        }),
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

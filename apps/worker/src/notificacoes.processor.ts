import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { enviarNotificacao, type EnviarPush, type PrismaClient } from '@pente-fino/db';
import { FILA_NOTIFICACOES, type TrabalhoNotificacao } from '@pente-fino/shared';
import { type Job, Worker } from 'bullmq';
import webpush from 'web-push';
import { Banco } from './banco.js';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

/** Envia pela fila; separado do Worker para ser testável sem Redis. */
export function processadorDeNotificacao(prisma: PrismaClient, enviar: EnviarPush) {
  return async (job: Job<TrabalhoNotificacao>): Promise<string> => {
    const r = await enviarNotificacao(prisma, job.data, enviar);
    return `${r.entregues}/${r.aparelhos} aparelho(s)`;
  };
}

/** Consome a fila "notificacoes" e entrega pelo Web Push (chaves VAPID do .env). */
@Injectable()
export class NotificacoesProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Notificacoes');
  private worker?: Worker<TrabalhoNotificacao>;

  constructor(
    @Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker,
    @Inject(Banco) private readonly banco: Banco,
  ) {}

  onModuleInit(): void {
    const c = this.config;
    if (!c.VAPID_CHAVE_PUBLICA || !c.VAPID_CHAVE_PRIVADA) {
      this.logger.warn('Sem chaves VAPID no .env: notificações no celular desligadas.');
      return;
    }
    webpush.setVapidDetails(c.VAPID_CONTATO, c.VAPID_CHAVE_PUBLICA, c.VAPID_CHAVE_PRIVADA);
    this.worker = new Worker<TrabalhoNotificacao>(
      FILA_NOTIFICACOES,
      processadorDeNotificacao(this.banco.prisma, async (inscricao, carga) => {
        const r = await webpush.sendNotification(inscricao, carga, { TTL: 3_600 });
        return r.statusCode;
      }),
      { connection: { url: c.REDIS_URL }, concurrency: 5 },
    );
    this.worker.on('failed', (job, erro) =>
      this.logger.error(`Notificação falhou (job ${job?.id}): ${erro.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { FILA_EVENTOS, type EventoDominio } from '@pente-fino/shared';
import { Worker } from 'bullmq';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

/**
 * Consome os eventos de domínio. Por enquanto só registra; as reações (lembrete,
 * comissão, indicadores, bot) entram com os módulos de cada etapa.
 */
@Injectable()
export class EventosProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Eventos');
  private worker?: Worker<EventoDominio>;

  constructor(@Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker) {}

  onModuleInit(): void {
    this.worker = new Worker<EventoDominio>(
      FILA_EVENTOS,
      async (job) => {
        this.logger.log(`${job.data.nome} (conta ${job.data.contaId})`);
      },
      { connection: { url: this.config.REDIS_URL } },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import {
  FILA_EMAILS,
  FILA_EVENTOS,
  FILA_NOTIFICACOES,
  FILA_PUSH_EQUIPE,
  FILA_WHATSAPP_ENTRADA,
  type EventoDominio,
  type TrabalhoNotificacao,
  type TrabalhoPushEquipe,
  type TrabalhoWhatsappEntrada,
  type NomeEvento,
  type TrabalhoEmail,
} from '@pente-fino/shared';
import { Queue, type DefaultJobOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

export const REDIS = Symbol('REDIS');

const OPCOES_PADRAO: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 5_000 },
};

/** Filas que a API alimenta. O worker (apps/worker) consome. */
@Injectable()
export class Filas implements OnApplicationShutdown {
  readonly emails: Queue<TrabalhoEmail>;
  readonly eventos: Queue<EventoDominio>;
  readonly whatsappEntrada: Queue<TrabalhoWhatsappEntrada>;
  readonly notificacoes: Queue<TrabalhoNotificacao>;
  /** Admin F6: push no celular da equipe (chat). */
  readonly pushEquipe: Queue<TrabalhoPushEquipe>;

  constructor(@Inject(CONFIGURACAO) config: Configuracao) {
    const connection = { url: config.redisUrl };
    this.emails = new Queue<TrabalhoEmail>(FILA_EMAILS, {
      connection,
      defaultJobOptions: OPCOES_PADRAO,
    });
    this.eventos = new Queue<EventoDominio>(FILA_EVENTOS, {
      connection,
      defaultJobOptions: OPCOES_PADRAO,
    });
    this.whatsappEntrada = new Queue<TrabalhoWhatsappEntrada>(FILA_WHATSAPP_ENTRADA, {
      connection,
      // Resposta atrasada demais não serve: poucas tentativas e rápidas.
      defaultJobOptions: {
        ...OPCOES_PADRAO,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
      },
    });
    this.notificacoes = new Queue<TrabalhoNotificacao>(FILA_NOTIFICACOES, {
      connection,
      defaultJobOptions: { ...OPCOES_PADRAO, attempts: 3 },
    });
    this.pushEquipe = new Queue<TrabalhoPushEquipe>(FILA_PUSH_EQUIPE, {
      connection,
      defaultJobOptions: { ...OPCOES_PADRAO, attempts: 2 },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.emails.close(),
      this.eventos.close(),
      this.whatsappEntrada.close(),
      this.notificacoes.close(),
      this.pushEquipe.close(),
    ]);
  }
}

/**
 * Publica eventos de domínio. Chame depois que a transação confirmou: se a publicação
 * falhar, o dado já está salvo e o erro aparece no log (sem desfazer a operação).
 */
@Injectable()
export class EventosService {
  constructor(@Inject(Filas) private readonly filas: Filas) {}

  async publicar<D extends Record<string, unknown>>(
    nome: NomeEvento,
    contaId: string,
    dados: D,
  ): Promise<void> {
    const evento: EventoDominio<D> = { nome, contaId, ocorridoEm: new Date().toISOString(), dados };
    await this.filas.eventos.add(nome, evento);
  }
}

@Global()
@Module({
  providers: [
    Filas,
    EventosService,
    {
      provide: REDIS,
      inject: [CONFIGURACAO],
      useFactory: (config: Configuracao) =>
        new Redis(config.redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        }),
    },
  ],
  exports: [Filas, EventosService, REDIS],
})
export class FilasModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
  }
}

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  atenderMensagem,
  prepararEnvio,
  registrarEnvio,
  type PrismaClient,
  type ResultadoAtendimento,
} from '@pente-fino/db';
import {
  FILA_WHATSAPP_ENTRADA,
  FILA_WHATSAPP_SAIDA,
  proximoEnvio,
  type EventoWhatsapp,
  type TrabalhoWhatsappSaida,
} from '@pente-fino/shared';
import { ProvedorEvolution, ProvedorFalso, type ProvedorWhatsApp } from '@pente-fino/whatsapp';
import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Banco } from './banco.js';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

/** Onde a próxima mensagem de cada número da barbearia pode sair (ms). */
export interface RelogioDeEnvio {
  ultimo(instancia: string): Promise<number | null>;
  marcar(instancia: string, quando: number): Promise<void>;
}

export const TENTATIVAS_ENVIO = 3;

/**
 * Coloca as respostas na fila de saída, uma atrás da outra, com o intervalo mínimo e uma
 * variação aleatória por número (proteção contra bloqueio do WhatsApp).
 */
export async function agendarRespostas(
  r: Extract<ResultadoAtendimento, { tipo: 'respondida' }>,
  deps: {
    relogio: RelogioDeEnvio;
    adicionar: (t: TrabalhoWhatsappSaida, atrasoMs: number) => Promise<unknown>;
    agora?: () => number;
    aleatorio?: () => number;
  },
): Promise<void> {
  const agora = deps.agora?.() ?? Date.now();
  let ultimo = await deps.relogio.ultimo(r.instancia);
  for (const mensagemId of r.saidas) {
    const quando = proximoEnvio(ultimo, agora, deps.aleatorio?.() ?? Math.random());
    await deps.adicionar({ contaId: r.contaId, mensagemId }, quando - agora);
    ultimo = quando;
  }
  if (ultimo !== null) await deps.relogio.marcar(r.instancia, ultimo);
}

/** Uma mensagem da fila de saída: confere se pode sair, envia e registra. */
export function processadorDeSaida(prisma: PrismaClient, provedor: ProvedorWhatsApp) {
  return async (job: Job<TrabalhoWhatsappSaida>): Promise<'enviada' | 'pulada'> => {
    const { contaId, mensagemId } = job.data;
    const preparo = await prepararEnvio(prisma, contaId, mensagemId);
    if (preparo.tipo === 'pular') return 'pulada';
    try {
      const r = await provedor.enviarTexto(preparo.instancia, preparo.telefone, preparo.texto);
      await registrarEnvio(prisma, contaId, mensagemId, { ok: true, idExterno: r.idExterno });
      return 'enviada';
    } catch (e) {
      const ultima = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (ultima)
        await registrarEnvio(prisma, contaId, mensagemId, {
          ok: false,
          erro: (e as Error).message,
        });
      throw e;
    }
  };
}

export function criarProvedor(c: ConfiguracaoWorker): ProvedorWhatsApp {
  if (c.WHATSAPP_PROVEDOR === 'falso') return new ProvedorFalso();
  return new ProvedorEvolution({ url: c.EVOLUTION_API_URL, chave: c.EVOLUTION_API_KEY });
}

/**
 * Bot do WhatsApp: a fila de entrada roda o menu para cada mensagem recebida (uma por vez,
 * para a sessão de cada número andar em ordem); a fila de saída envia as respostas.
 */
@Injectable()
export class WhatsappProcessor implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('WhatsApp');
  private entrada?: Worker<EventoWhatsapp>;
  private saida?: Worker<TrabalhoWhatsappSaida>;
  private filaSaida?: Queue<TrabalhoWhatsappSaida>;
  private redis?: Redis;

  constructor(
    @Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker,
    @Inject(Banco) private readonly banco: Banco,
  ) {}

  onModuleInit(): void {
    const connection = { url: this.config.REDIS_URL };
    const provedor = criarProvedor(this.config);
    if (provedor.nome === 'falso')
      this.logger.warn('WHATSAPP_PROVEDOR=falso: as respostas não saem de verdade.');
    const filaSaida = new Queue<TrabalhoWhatsappSaida>(FILA_WHATSAPP_SAIDA, {
      connection,
      defaultJobOptions: {
        attempts: TENTATIVAS_ENVIO,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 5_000 },
      },
    });
    this.filaSaida = filaSaida;
    const redis = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: 3 });
    this.redis = redis;
    const chave = (instancia: string) => `whatsapp:proximo-envio:${instancia}`;
    const relogio: RelogioDeEnvio = {
      ultimo: async (instancia) => {
        const v = await redis.get(chave(instancia));
        return v ? Number(v) : null;
      },
      marcar: async (instancia, quando) => {
        await redis.set(chave(instancia), String(quando), 'PX', 300_000);
      },
    };

    this.entrada = new Worker<EventoWhatsapp>(
      FILA_WHATSAPP_ENTRADA,
      async (job) => {
        if (job.data.tipo !== 'mensagem') return;
        const r = await atenderMensagem(this.banco.prisma, job.data, {
          appUrl: this.config.APP_URL,
        });
        if (r.tipo !== 'respondida') return r.tipo;
        await agendarRespostas(r, {
          relogio,
          adicionar: (t, atrasoMs) =>
            filaSaida.add('enviar', t, { delay: Math.max(0, atrasoMs), jobId: t.mensagemId }),
        });
        return r.tipo;
      },
      { connection, concurrency: 1 },
    );
    this.entrada.on('failed', (job, erro) =>
      this.logger.error(`Mensagem recebida falhou (job ${job?.id}): ${erro.message}`),
    );

    this.saida = new Worker<TrabalhoWhatsappSaida>(
      FILA_WHATSAPP_SAIDA,
      processadorDeSaida(this.banco.prisma, provedor),
      { connection, concurrency: 3 },
    );
    this.saida.on('failed', (job, erro) =>
      this.logger.error(
        `Envio falhou (mensagem ${job?.data.mensagemId}, tentativa ${job?.attemptsMade}): ${erro.message}`,
      ),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.entrada?.close(), this.saida?.close()]);
    await this.filaSaida?.close();
    this.redis?.disconnect();
  }
}

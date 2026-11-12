import { writeFile } from 'node:fs/promises';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ARQUIVO_BATIMENTO_WORKER,
  CHAVE_BATIMENTO_WORKER,
  CHAVE_ROTINAS_WORKER,
  ROTINAS_WORKER,
  type RotinaWorker,
} from '@pente-fino/shared';
import { Redis } from 'ioredis';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

const INTERVALO_MS = 30_000;
const NOMES = new Set<string>(ROTINAS_WORKER.map((r) => r.rotina));

/** A rotina agendada que este trabalho representa, ou null (mensagem, lembrete...). */
export function rotinaDoTrabalho(tipo: unknown): RotinaWorker | null {
  return typeof tipo === 'string' && NOMES.has(tipo) ? (tipo as RotinaWorker) : null;
}

/**
 * V3: o worker avisa que está vivo. A cada 30 s grava a hora no Redis (a Saúde do sistema lê)
 * e num arquivo (o healthcheck do Docker confere). Guarda também a última execução de cada
 * rotina agendada, para a administração ver rotina parada.
 */
@Injectable()
export class Batimento implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Batimento');
  private redis?: Redis;
  private relogio?: NodeJS.Timeout;

  constructor(@Inject(CONFIGURACAO_WORKER) private readonly config: ConfiguracaoWorker) {}

  onModuleInit(): void {
    this.redis = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: 3 });
    void this.bater();
    this.relogio = setInterval(() => void this.bater(), INTERVALO_MS);
    this.relogio.unref();
  }

  private async bater(): Promise<void> {
    const agora = new Date().toISOString();
    try {
      await this.redis?.set(CHAVE_BATIMENTO_WORKER, agora, 'EX', 7 * 24 * 3600);
    } catch (e) {
      this.logger.error(`Batimento no Redis: ${(e as Error).message}`);
    }
    // O arquivo só muda se o processo está de pé: travou, o Docker reinicia.
    await writeFile(ARQUIVO_BATIMENTO_WORKER, agora).catch(() => undefined);
  }

  async registrarRotina(rotina: RotinaWorker, resultado: unknown): Promise<void> {
    const valor = JSON.stringify({
      quando: new Date().toISOString(),
      resultado: String(resultado ?? '').slice(0, 200),
    });
    await this.redis
      ?.hset(CHAVE_ROTINAS_WORKER, rotina, valor)
      .catch((e: Error) => this.logger.error(`Registrar a rotina ${rotina}: ${e.message}`));
  }

  onApplicationShutdown(): void {
    if (this.relogio) clearInterval(this.relogio);
    this.redis?.disconnect();
  }
}

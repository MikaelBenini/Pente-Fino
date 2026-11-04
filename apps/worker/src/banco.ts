import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import { CONFIGURACAO_WORKER, type ConfiguracaoWorker } from './config.js';

/** Um cliente Prisma por processo. Consultas de negócio sempre dentro de naConta(). */
@Injectable()
export class Banco implements OnApplicationShutdown {
  readonly prisma: PrismaClient;

  constructor(@Inject(CONFIGURACAO_WORKER) config: ConfiguracaoWorker) {
    this.prisma = criarPrisma(config.DATABASE_URL);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

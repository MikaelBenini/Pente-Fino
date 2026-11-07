import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { criarPrisma, type PrismaClient } from '@pente-fino/db';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { Erros } from '../comum/erros.js';

/**
 * Conexão da administração, com o usuário de banco da plataforma: lê e grava só as tabelas
 * da plataforma e chama as funções de leitura entre contas. Separada da conexão das barbearias.
 */
@Injectable()
export class BancoPlataforma implements OnModuleDestroy {
  private cliente: PrismaClient | null = null;

  constructor(@Inject(CONFIGURACAO) private readonly config: Configuracao) {}

  get prisma(): PrismaClient {
    if (!this.config.plataforma.databaseUrl)
      throw Erros.indisponivel('A administração não está configurada (DATABASE_PLATAFORMA_URL).');
    this.cliente ??= criarPrisma(this.config.plataforma.databaseUrl);
    return this.cliente;
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente?.$disconnect();
  }
}

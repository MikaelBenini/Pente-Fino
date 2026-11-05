import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { criarPrisma, naConta, type PrismaClient, type Transacao } from '@pente-fino/db';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { Contexto } from './contexto.js';

/**
 * Acesso ao banco. Toda consulta de negócio passa por daConta(), que usa a conta do
 * usuário autenticado (do token, nunca do corpo da requisição) e abre a transação
 * com app.conta_id definido. O RLS do PostgreSQL faz o resto.
 */
@Injectable()
export class BancoService implements OnApplicationShutdown {
  readonly prisma: PrismaClient;

  constructor(@Inject(CONFIGURACAO) config: Configuracao) {
    this.prisma = criarPrisma(config.databaseUrl);
  }

  /** Transação na conta do usuário autenticado. */
  daConta<T>(fn: (tx: Transacao) => Promise<T>): Promise<T> {
    return naConta(this.prisma, Contexto.usuario().contaId, fn);
  }

  /** Transação numa conta conhecida por outro meio confiável (token validado, evento da fila). */
  naConta<T>(contaId: string, fn: (tx: Transacao) => Promise<T>): Promise<T> {
    return naConta(this.prisma, contaId, fn);
  }

  /**
   * Leitura antes de saber a conta: declara na transação o e-mail do login ou o hash
   * de um token. As políticas login_por_email e busca_por_hash liberam só essa linha.
   */
  semConta<T>(
    chave:
      | { loginEmail: string }
      | { tokenHash: string }
      | { slugPublico: string }
      | { clienteAsaas: string },
    fn: (tx: Transacao) => Promise<T>,
  ): Promise<T> {
    const [nome, valor] =
      'loginEmail' in chave
        ? ['app.login_email', chave.loginEmail]
        : 'tokenHash' in chave
          ? ['app.token_hash', chave.tokenHash]
          : 'slugPublico' in chave
            ? ['app.slug_publico', chave.slugPublico]
            : ['app.cliente_asaas', chave.clienteAsaas];
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config(${nome}, ${valor}, true)`;
      return fn(tx);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

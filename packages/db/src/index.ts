// Acesso ao banco para a API e o worker.
//
// Regra de ouro: toda consulta de negócio roda dentro de naConta(), que abre uma
// transação com app.conta_id definido. Fora dela o RLS não libera nenhuma linha.
// O usuário de DATABASE_URL não é superusuário nem dono das tabelas.
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export * from './avisos.js';
export * from './modelos.js';
export * from './vigencia.js';
export * from './bot.js';
export * from './avaliacao.js';
export * from './assinatura.js';

/** Cliente dentro de uma transação de naConta(). */
export type Transacao = Prisma.TransactionClient;

/** Cria o cliente Prisma com o driver pg. Use uma instância por processo. */
export function criarPrisma(url: string | undefined = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error('DATABASE_URL não definida');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OpcoesNaConta {
  /** Tempo máximo da transação em ms (padrão do Prisma: 5000). */
  timeout?: number;
  /** Espera máxima por uma conexão livre em ms. */
  maxWait?: number;
}

/**
 * Roda `fn` numa transação isolada na conta informada.
 * O contaId vem do token do usuário autenticado, nunca do corpo da requisição.
 */
export async function naConta<T>(
  prisma: PrismaClient,
  contaId: string,
  fn: (tx: Transacao) => Promise<T>,
  opcoes: OpcoesNaConta = {},
): Promise<T> {
  if (!FORMATO_UUID.test(contaId)) throw new TypeError(`contaId inválido: ${contaId}`);
  return prisma.$transaction(async (tx) => {
    // true = vale só para esta transação; a conexão volta limpa para o pool.
    await tx.$queryRaw`SELECT set_config('app.conta_id', ${contaId}, true)`;
    return fn(tx);
  }, opcoes);
}
export * from './agenda.js';
export * from './agendar-bot.js';
export * from './lembretes.js';
export * from './equipe-whatsapp.js';
export * from './link-horario.js';
export * from './token-agendamento.js';
export * from './push.js';
export * from './automacoes.js';
export * from './clube.js';
export * from './espera.js';
export * from './atraso.js';
export * from './mover.js';
export * from './central-avisos.js';
export * from './plataforma.js';
export * from './cobranca-manual.js';
export * from './limpeza.js';
export * from './cifra.js';

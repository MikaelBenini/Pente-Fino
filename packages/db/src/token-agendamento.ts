// Link do site mandado pelo bot (/agendar?u=slug&c=token): nome e telefone já preenchidos,
// sem dado pessoal na URL. O token é curto, vale 48 h, serve uma vez e fica só como hash.
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from './generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export const VALIDADE_TOKEN_AGENDAMENTO_H = 48;

export const hashTokenAgendamento = (token: string) =>
  createHash('sha256').update(`agendar:${token}`).digest('hex');

/** Gera o token do cliente para a unidade (10 caracteres, ~60 bits). */
export async function criarTokenDeAgendamento(
  tx: Tx,
  unidadeId: string,
  clienteId: string,
  agora = new Date(),
): Promise<string> {
  const token = randomBytes(8).toString('base64url').slice(0, 10);
  await tx.tokenAgendamento.create({
    data: {
      unidadeId,
      clienteId,
      tokenHash: hashTokenAgendamento(token),
      expiraEm: new Date(agora.getTime() + VALIDADE_TOKEN_AGENDAMENTO_H * 3_600_000),
    },
  });
  return token;
}

/** O token ainda vale para esta unidade (não usado, não vencido)? Devolve o cliente. */
export async function clienteDoToken(tx: Tx, unidadeId: string, token: string, agora = new Date()) {
  const t = await tx.tokenAgendamento.findUnique({
    where: { tokenHash: hashTokenAgendamento(token) },
    include: { cliente: true },
  });
  if (!t || t.unidadeId !== unidadeId || t.usadoEm || t.expiraEm <= agora) return null;
  return { tokenId: t.id, cliente: t.cliente };
}

/** Marca como usado (uma vez só); false se outro pedido usou antes. */
export async function usarToken(tx: Tx, tokenId: string, agora = new Date()): Promise<boolean> {
  const r = await tx.tokenAgendamento.updateMany({
    where: { id: tokenId, usadoEm: null },
    data: { usadoEm: agora },
  });
  return r.count === 1;
}

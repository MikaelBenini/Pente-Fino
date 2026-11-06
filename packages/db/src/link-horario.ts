// Link do cliente para o próprio horário (/horario?t=token): o token só sai na confirmação
// (bot ou site) e fica gravado como hash. Remarcar pelo cliente é o mesmo para bot e site.
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from './generated/prisma/client.js';
import { moverAgendamento } from './agenda.js';

type Tx = Prisma.TransactionClient;

export const hashTokenHorario = (token: string) =>
  createHash('sha256').update(`horario:${token}`).digest('hex');

/** Gera o link do horário (substitui o anterior, que deixa de abrir). Devolve o token. */
export async function criarLinkDoHorario(tx: Tx, agendamentoId: string): Promise<string> {
  const token = randomBytes(16).toString('base64url');
  const tokenHash = hashTokenHorario(token);
  await tx.linkHorario.upsert({
    where: { agendamentoId },
    create: { agendamentoId, tokenHash },
    update: { tokenHash, criadoEm: new Date() },
  });
  return token;
}

/** O cliente remarcou (conversa ou link): move o horário e fica na auditoria sem usuário. */
export async function remarcarPeloCliente(
  tx: Tx,
  agendamentoId: string,
  inicio: Date,
  canal: string,
  profissionalId?: string,
) {
  const r = await moverAgendamento(tx, agendamentoId, inicio, profissionalId);
  const prof = profissionalId ?? r.antes.profissionalId;
  await tx.auditoria.create({
    data: {
      usuarioId: null,
      entidade: 'agendamento',
      entidadeId: agendamentoId,
      acao: 'remarcar_pelo_cliente',
      antes: { inicio: r.antes.inicio.toISOString(), profissionalId: r.antes.profissionalId },
      depois: { inicio: inicio.toISOString(), profissionalId: prof },
      motivo: `Remarcado pelo cliente (${canal})`,
    },
  });
  return r;
}

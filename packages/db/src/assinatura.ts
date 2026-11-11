// Situação da assinatura da conta atual (dentro de naConta): base do bloqueio só para consulta.
import { situacaoAssinatura, type EstadoDaConta } from '@pente-fino/shared';
import type { Prisma } from './generated/prisma/client.js';

export async function estadoAssinatura(
  tx: Prisma.TransactionClient,
  agora = new Date(),
): Promise<EstadoDaConta> {
  const conta = await tx.conta.findFirstOrThrow({
    select: { status: true, testeAte: true, cortesiaAte: true, plano: true },
  });
  const faturas = await tx.faturaAssinatura.findMany({
    where: { status: { in: ['aberta', 'recusada', 'paga'] } },
    orderBy: { vencimento: 'desc' },
    take: 24,
    select: { status: true, vencimento: true },
  });
  const situacao = situacaoAssinatura(
    conta,
    faturas.map((f) => ({ status: f.status, vencimento: f.vencimento.toISOString().slice(0, 10) })),
    agora,
  );
  return { ...situacao, plano: conta.plano };
}

// Vocabulário do segmento da conta atual (dentro de naConta, Fase 1a de 27/11/2026): o que o bot,
// os e-mails e as mensagens da API dizem no lugar de "barbeiro" e "barbearia".
import { vocabulario, type Vocabulario } from '@pente-fino/shared';
import type { Prisma } from './generated/prisma/client.js';

export async function vocabularioDaConta(tx: Prisma.TransactionClient): Promise<Vocabulario> {
  const conta = await tx.conta.findFirst({ select: { segmento: true } });
  return vocabulario(conta?.segmento);
}

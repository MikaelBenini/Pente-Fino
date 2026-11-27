// Situação da assinatura da conta atual (dentro de naConta): base do bloqueio só para consulta.
import {
  automacoesIncluidasNaLicenca,
  situacaoAssinatura,
  recursoDaConta,
  type EstadoDaConta,
  type Recurso,
} from '@pente-fino/shared';
import type { Prisma } from './generated/prisma/client.js';

export async function estadoAssinatura(
  tx: Prisma.TransactionClient,
  agora = new Date(),
): Promise<EstadoDaConta> {
  const conta = await tx.conta.findFirstOrThrow({
    select: {
      status: true,
      testeAte: true,
      cortesiaAte: true,
      plano: true,
      automacoesContratadas: true,
      licenca: true,
      experimentaBasicoAte: true,
      criadoEm: true,
    },
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
  return {
    ...situacao,
    plano: conta.plano,
    // Licença Atendimento: o bot inteiro (as Automações) vem no preço (ADR 0015).
    automacoes: conta.automacoesContratadas || automacoesIncluidasNaLicenca(conta.licenca),
    experimentaAte: conta.experimentaBasicoAte?.toISOString() ?? null,
    contaDesde: conta.criadoEm.toISOString(),
  };
}

/** A conta atual (dentro de naConta) tem o recurso, com as Automações contratadas à parte? */
export async function temNaConta(tx: Prisma.TransactionClient, r: Recurso): Promise<boolean> {
  const conta = await tx.conta.findFirst({
    select: { plano: true, automacoesContratadas: true, experimentaBasicoAte: true, licenca: true },
  });
  return (
    !!conta &&
    recursoDaConta(
      {
        plano: conta.plano,
        automacoes: conta.automacoesContratadas || automacoesIncluidasNaLicenca(conta.licenca),
        experimentaAte: conta.experimentaBasicoAte,
      },
      r,
    )
  );
}

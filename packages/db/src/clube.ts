// Clube da barbearia: adesão ativa do cliente e usos do ciclo, lidos das comandas (nunca de um
// contador): cancelar ou reabrir uma comanda já corrige o uso. Fonte única para API e bot.
import {
  cicloDaAdesao,
  restantesDoCiclo,
  situacaoDaAdesao,
  type AdesaoDetalhe,
  type DataISO,
  type UsosDoCiclo,
} from '@pente-fino/shared';
import type { Prisma } from './generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

const iso = (d: Date) => d.toISOString().slice(0, 10) as DataISO;
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00-03:00`);

/** Itens cobertos pela adesão no ciclo atual (comandas não canceladas). */
export async function usosDoCiclo(
  tx: Tx,
  adesaoId: string,
  vencimento: DataISO,
): Promise<UsosDoCiclo> {
  const { de, ate } = cicloDaAdesao(vencimento);
  const fim = new Date(inicioDoDia(ate).getTime() + 86_400_000);
  const itens = await tx.itemComanda.findMany({
    where: {
      adesaoId,
      cobertoClube: true,
      comanda: { status: { not: 'cancelada' }, criadoEm: { gte: inicioDoDia(de), lt: fim } },
    },
    select: { servicoId: true, quantidade: true },
  });
  const porServico: Record<string, number> = {};
  let total = 0;
  for (const i of itens) {
    if (!i.servicoId) continue;
    porServico[i.servicoId] = (porServico[i.servicoId] ?? 0) + i.quantidade;
    total += i.quantidade;
  }
  return { total, porServico };
}

const incluir = {
  cliente: { select: { id: true, nome: true } },
  itemClube: { include: { servicos: { include: { servico: { select: { nome: true } } } } } },
} as const;

type AdesaoComPlano = Prisma.AdesaoClubeGetPayload<{ include: typeof incluir }>;

/** Adesão ativa (status) do cliente, com o plano; null se não tem. */
export async function adesaoDoCliente(tx: Tx, clienteId: string): Promise<AdesaoComPlano | null> {
  return tx.adesaoClube.findFirst({ where: { clienteId, status: 'ativa' }, include: incluir });
}

/** A adesão como as telas mostram: situação do dia, usos e o que resta no ciclo. */
export async function detalharAdesao(
  tx: Tx,
  a: AdesaoComPlano,
  hoje: DataISO,
): Promise<AdesaoDetalhe> {
  const vencimento = iso(a.vencimento);
  const usos = await usosDoCiclo(tx, a.id, vencimento);
  const plano = {
    limiteUsoMes: a.itemClube.limiteUsoMes,
    servicos: a.itemClube.servicos.map((s) => ({
      servicoId: s.servicoId,
      quantidade: s.quantidade,
    })),
  };
  return {
    id: a.id,
    cliente: a.cliente,
    plano: {
      id: a.itemClube.id,
      nome: a.itemClube.nome,
      tipo: a.itemClube.tipo,
      valor: a.itemClube.valor,
    },
    situacao: situacaoDaAdesao(a.status, vencimento, hoje),
    inicio: iso(a.inicio),
    vencimento,
    usosNoCiclo: usos.total,
    restantes: restantesDoCiclo(plano, usos).map((r) => ({
      ...r,
      servico: a.itemClube.servicos.find((s) => s.servicoId === r.servicoId)!.servico.nome,
    })),
  };
}

export { incluir as INCLUIR_ADESAO };

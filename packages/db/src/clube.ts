// Clube da barbearia: adesão ativa do cliente e usos do ciclo, lidos das comandas (nunca de um
// contador): cancelar ou reabrir uma comanda já corrige o uso. Fonte única para API e bot.
import {
  cicloDaAdesao,
  coberturaDoServico,
  saldoDoPacote,
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

export interface ParteDoItem {
  quantidade: number;
  precoUnitario: number;
  cobertoClube: boolean;
  adesaoId: string | null;
  /** Sessão de um pacote do cliente (Fase 1d): valor zero, a receita veio na venda do pacote. */
  pacoteClienteId?: string | null;
}

/** Sessões usadas de um pacote, lidas das comandas não canceladas (nunca de um contador). */
export async function usadasDoPacote(tx: Tx, pacoteClienteId: string): Promise<number> {
  const r = await tx.itemComanda.aggregate({
    where: { pacoteClienteId, comanda: { status: { not: 'cancelada' } } },
    _sum: { quantidade: true },
  });
  return r._sum.quantidade ?? 0;
}

/**
 * Pacotes do cliente que cobrem o serviço no dia (ativos, da unidade, com saldo), o que vence
 * primeiro antes.
 */
async function pacotesQueCobrem(
  tx: Tx,
  d: { clienteId: string; unidadeId: string; servicoId: string; dia: DataISO },
): Promise<{ id: string; saldo: number }[]> {
  const pacotes = await tx.pacoteCliente.findMany({
    where: {
      clienteId: d.clienteId,
      unidadeId: d.unidadeId,
      servicoId: d.servicoId,
      canceladoEm: null,
      validoAte: { gte: new Date(`${d.dia}T00:00:00Z`) },
    },
    orderBy: [{ validoAte: 'asc' }, { criadoEm: 'asc' }],
    select: { id: true, sessoes: true },
  });
  const comSaldo: { id: string; saldo: number }[] = [];
  for (const p of pacotes) {
    const saldo = saldoDoPacote(p.sessoes, await usadasDoPacote(tx, p.id));
    if (saldo > 0) comSaldo.push({ id: p.id, saldo });
  }
  return comSaldo;
}

/**
 * Serviço lançado para o cliente (RN-07): a parte que o plano cobre entra com valor zero, ligada
 * à adesão; o que passa do limite (ou está fora do plano) entra com o preço normal. Só vale a
 * adesão em dia e na unidade do plano.
 */
async function partesDoClube(
  tx: Tx,
  d: {
    clienteId: string | null;
    unidadeId: string;
    servicoId: string;
    quantidade: number;
    preco: number;
    dia: DataISO;
  },
): Promise<ParteDoItem[]> {
  const normal: ParteDoItem[] = [
    { quantidade: d.quantidade, precoUnitario: d.preco, cobertoClube: false, adesaoId: null },
  ];
  if (!d.clienteId) return normal;
  const a = await adesaoDoCliente(tx, d.clienteId);
  if (!a || a.itemClube.unidadeId !== d.unidadeId) return normal;
  const vencimento = iso(a.vencimento);
  if (situacaoDaAdesao(a.status, vencimento, d.dia) !== 'ativa') return normal;
  const plano = {
    limiteUsoMes: a.itemClube.limiteUsoMes,
    servicos: a.itemClube.servicos.map((s) => ({
      servicoId: s.servicoId,
      quantidade: s.quantidade,
    })),
  };
  const { cobertas, extras } = coberturaDoServico(
    plano,
    await usosDoCiclo(tx, a.id, vencimento),
    d.servicoId,
    d.quantidade,
  );
  return [
    ...(cobertas > 0
      ? [{ quantidade: cobertas, precoUnitario: 0, cobertoClube: true, adesaoId: a.id }]
      : []),
    ...(extras > 0
      ? [{ quantidade: extras, precoUnitario: d.preco, cobertoClube: false, adesaoId: null }]
      : []),
  ];
}

/**
 * Serviço lançado para o cliente: o que o clube cobre entra com valor zero (RN-07); depois, o que
 * um pacote pago antes cobre (Fase 1d, igual ao clube); o resto, com o preço normal.
 */
export async function partesDoServico(
  tx: Tx,
  d: {
    clienteId: string | null;
    unidadeId: string;
    servicoId: string;
    quantidade: number;
    preco: number;
    dia: DataISO;
  },
): Promise<ParteDoItem[]> {
  const partes = await partesDoClube(tx, d);
  const normal = partes.find((p) => !p.cobertoClube);
  if (!d.clienteId || !normal) return partes;
  const pacotes = await pacotesQueCobrem(tx, {
    clienteId: d.clienteId,
    unidadeId: d.unidadeId,
    servicoId: d.servicoId,
    dia: d.dia,
  });
  if (pacotes.length === 0) return partes;
  const resultado = partes.filter((p) => p !== normal);
  let falta = normal.quantidade;
  for (const p of pacotes) {
    if (falta === 0) break;
    const usar = Math.min(falta, p.saldo);
    resultado.push({
      quantidade: usar,
      precoUnitario: 0,
      cobertoClube: false,
      adesaoId: null,
      pacoteClienteId: p.id,
    });
    falta -= usar;
  }
  if (falta > 0) resultado.push({ ...normal, quantidade: falta });
  return resultado;
}

/** Comissão fixa que o dono definiu para o serviço no plano da adesão (null = % do barbeiro). */
export async function comissaoFixaDoClube(
  tx: Tx,
  adesaoId: string,
  servicoId: string,
): Promise<number | null> {
  const a = await tx.adesaoClube.findUnique({
    where: { id: adesaoId },
    select: { itemClubeId: true },
  });
  if (!a) return null;
  const s = await tx.itemClubeServico.findUnique({
    where: { itemClubeId_servicoId: { itemClubeId: a.itemClubeId, servicoId } },
    select: { comissaoValorFixo: true },
  });
  return s?.comissaoValorFixo ?? null;
}

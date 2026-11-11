// Unidades lado a lado (Etapa 15, RF-23; em Resultados do mês): unidades lado a lado e o total da rede. Regras puras; a
// API calcula cada unidade com as mesmas regras do resto do sistema.
import type { Ocupacao } from './desempenho.js';

export const METRICAS_REDE = [
  'faturamento',
  'lucro',
  'ticketMedio',
  'ocupacao',
  'nota',
  'retorno',
] as const;
export type MetricaRede = (typeof METRICAS_REDE)[number];

export const NOME_METRICA_REDE: Readonly<Record<MetricaRede, string>> = {
  faturamento: 'Faturamento',
  lucro: 'Lucro',
  ticketMedio: 'Ticket médio',
  ocupacao: 'Ocupação',
  nota: 'Nota média',
  retorno: 'Retorno no prazo',
};

export interface NumerosDaRede {
  faturamento: number;
  /** Faturamento − despesas operacionais da unidade (as da conta ficam só no total). */
  lucro: number;
  clientes: number;
  ticketMedio: number;
  ocupacao: Ocupacao;
  /** Nota da barbearia na pesquisa; null sem resposta. */
  nota: { media: number | null; respostas: number };
  retorno: { atendidos: number; voltaramNoPrazo: number; taxa: number };
}

export interface LinhaDaRede extends NumerosDaRede {
  unidadeId: string;
  unidade: string;
}

export interface PainelDaRede {
  de: string;
  ate: string;
  unidades: LinhaDaRede[];
  rede: NumerosDaRede;
  /** Unidade que vai melhor em cada indicador (null: uma unidade só, empate ou sem dado). */
  destaques: Record<MetricaRede, string | null>;
}

/** O número que compara as unidades em cada indicador (null = sem dado). */
export function valorDaMetrica(n: NumerosDaRede, m: MetricaRede): number | null {
  switch (m) {
    case 'faturamento':
      return n.faturamento;
    case 'lucro':
      return n.lucro;
    case 'ticketMedio':
      return n.clientes ? n.ticketMedio : null;
    case 'ocupacao':
      return n.ocupacao.disponivelMin ? n.ocupacao.fracao : null;
    case 'nota':
      return n.nota.media;
    case 'retorno':
      return n.retorno.atendidos ? n.retorno.taxa : null;
  }
}

/**
 * Total da rede: somas para dinheiro e clientes; ticket, ocupação, nota e retorno pesados
 * pelo que cada unidade tem (clientes, minutos, respostas, atendidos). `despesasDaConta` são as
 * despesas operacionais sem unidade, que só entram no lucro da rede.
 */
export function totalDaRede(linhas: readonly NumerosDaRede[], despesasDaConta = 0): NumerosDaRede {
  const soma = (f: (l: NumerosDaRede) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const faturamento = soma((l) => l.faturamento);
  const clientes = soma((l) => l.clientes);
  const disponivelMin = soma((l) => l.ocupacao.disponivelMin);
  const agendadoMin = soma((l) => l.ocupacao.agendadoMin);
  const respostas = soma((l) => l.nota.respostas);
  const pontos = soma((l) => (l.nota.media ?? 0) * l.nota.respostas);
  const atendidos = soma((l) => l.retorno.atendidos);
  const voltaramNoPrazo = soma((l) => l.retorno.voltaramNoPrazo);
  return {
    faturamento,
    lucro: soma((l) => l.lucro) - despesasDaConta,
    clientes,
    ticketMedio: clientes ? Math.round(faturamento / clientes) : 0,
    ocupacao: {
      disponivelMin,
      agendadoMin,
      fracao: disponivelMin ? agendadoMin / disponivelMin : 0,
    },
    nota: { media: respostas ? Math.round((pontos / respostas) * 10) / 10 : null, respostas },
    retorno: {
      atendidos,
      voltaramNoPrazo,
      taxa: atendidos ? voltaramNoPrazo / atendidos : 0,
    },
  };
}

/** Em cada indicador, a unidade com o maior valor (só com duas ou mais e sem empate no topo). */
export function destaquesDaRede(
  linhas: readonly LinhaDaRede[],
): Record<MetricaRede, string | null> {
  const r = {} as Record<MetricaRede, string | null>;
  for (const m of METRICAS_REDE) {
    const com = linhas
      .map((l) => ({ id: l.unidadeId, v: valorDaMetrica(l, m) }))
      .filter((x): x is { id: string; v: number } => x.v !== null);
    if (linhas.length < 2 || com.length === 0) {
      r[m] = null;
      continue;
    }
    const maior = Math.max(...com.map((x) => x.v));
    const topo = com.filter((x) => x.v === maior);
    r[m] = topo.length === 1 && maior > 0 ? topo[0]!.id : null;
  }
  return r;
}

// Relatório do mês, comparado com o mês anterior (Etapa 23.1). Regras puras: a direção de cada
// indicador (falta menor é melhor), as frases "o que melhorou / piorou", custo e lucro de cada
// barbeiro com os pontos fortes e fracos dele contra a equipe, e o mix de serviços e produtos.
import type { Canal } from './canais.js';

export interface NumerosDoMes {
  faturamento: number;
  /** null quando o plano não tem lucro real (a linha some do relatório). */
  lucro: number | null;
  atendimentos: number;
  clientes: number;
  ticketMedio: number;
  /** Fração (0,25 = 25%). */
  percentualExtras: number;
  clientesNovos: number;
  /** Voltaram dentro do costume ÷ atendidos (fração). */
  taxaRetorno: number;
  faltas: number;
  /** Faltas ÷ (agendados − cancelados) (fração); null sem agendamento. */
  taxaFaltas: number | null;
  /** Nota média do atendimento (1 a 5); null sem resposta. */
  notaMedia: number | null;
  /** Atendidos por canal (WhatsApp, site, balcão, app, sem horário). */
  porCanal: Partial<Record<Canal, number>>;
}

export type FormatoIndicador = 'moeda' | 'numero' | 'fracao' | 'nota';
export type ChaveIndicador =
  | 'faturamento'
  | 'lucro'
  | 'atendimentos'
  | 'clientes'
  | 'ticketMedio'
  | 'percentualExtras'
  | 'clientesNovos'
  | 'taxaRetorno'
  | 'taxaFaltas'
  | 'notaMedia';

interface DefinicaoIndicador {
  chave: ChaveIndicador;
  rotulo: string;
  formato: FormatoIndicador;
  melhorQuando: 'maior' | 'menor';
  /** Como aparece na frase ("o faturamento"). */
  naFrase: string;
}

export const INDICADORES_RELATORIO: readonly DefinicaoIndicador[] = [
  {
    chave: 'faturamento',
    rotulo: 'Faturamento',
    formato: 'moeda',
    melhorQuando: 'maior',
    naFrase: 'o faturamento',
  },
  { chave: 'lucro', rotulo: 'Lucro', formato: 'moeda', melhorQuando: 'maior', naFrase: 'o lucro' },
  {
    chave: 'atendimentos',
    rotulo: 'Atendimentos',
    formato: 'numero',
    melhorQuando: 'maior',
    naFrase: 'os atendimentos',
  },
  {
    chave: 'clientes',
    rotulo: 'Clientes atendidos',
    formato: 'numero',
    melhorQuando: 'maior',
    naFrase: 'os clientes atendidos',
  },
  {
    chave: 'ticketMedio',
    rotulo: 'Ticket médio',
    formato: 'moeda',
    melhorQuando: 'maior',
    naFrase: 'o ticket médio',
  },
  {
    chave: 'percentualExtras',
    rotulo: 'Extras por cliente',
    formato: 'fracao',
    melhorQuando: 'maior',
    naFrase: 'a venda de extras',
  },
  {
    chave: 'clientesNovos',
    rotulo: 'Clientes novos',
    formato: 'numero',
    melhorQuando: 'maior',
    naFrase: 'os clientes novos',
  },
  {
    chave: 'taxaRetorno',
    rotulo: 'Retorno dos clientes',
    formato: 'fracao',
    melhorQuando: 'maior',
    naFrase: 'o retorno dos clientes',
  },
  {
    chave: 'taxaFaltas',
    rotulo: 'Faltas',
    formato: 'fracao',
    melhorQuando: 'menor',
    naFrase: 'as faltas',
  },
  {
    chave: 'notaMedia',
    rotulo: 'Nota dos clientes',
    formato: 'nota',
    melhorQuando: 'maior',
    naFrase: 'a nota dos clientes',
  },
];

export type Tendencia = 'melhorou' | 'piorou' | 'igual';

export interface LinhaComparativo {
  chave: ChaveIndicador;
  rotulo: string;
  formato: FormatoIndicador;
  atual: number | null;
  anterior: number | null;
  /** Variação relativa (0,12 = +12%); para frações e nota, a diferença em pontos. */
  variacao: number | null;
  tendencia: Tendencia;
}

/** Abaixo disso a mudança é ruído e conta como "igual". */
const LIMIAR_RELATIVO = 0.02;
const LIMIAR_PONTOS: Record<FormatoIndicador, number> = {
  moeda: 0,
  numero: 0,
  fracao: 0.01,
  nota: 0.05,
};

/** Indicador por indicador: atual, anterior, variação e se melhorou (pela direção dele). */
export function compararMeses(atual: NumerosDoMes, anterior: NumerosDoMes): LinhaComparativo[] {
  return INDICADORES_RELATORIO.filter((d) => !(d.chave === 'lucro' && atual.lucro === null)).map(
    (d) => {
      const a = atual[d.chave];
      const b = anterior[d.chave];
      let variacao: number | null = null;
      let tendencia: Tendencia = 'igual';
      if (a !== null && b !== null) {
        const emPontos = d.formato === 'fracao' || d.formato === 'nota';
        variacao = emPontos ? a - b : b === 0 ? (a === 0 ? 0 : null) : (a - b) / Math.abs(b);
        const relevante = emPontos
          ? Math.abs(a - b) >= LIMIAR_PONTOS[d.formato]
          : b === 0
            ? a !== 0
            : Math.abs((a - b) / b) >= LIMIAR_RELATIVO;
        if (relevante && a !== b) {
          const subiu = a > b;
          tendencia = subiu === (d.melhorQuando === 'maior') ? 'melhorou' : 'piorou';
        }
      }
      return {
        chave: d.chave,
        rotulo: d.rotulo,
        formato: d.formato,
        atual: a,
        anterior: b,
        variacao,
        tendencia,
      };
    },
  );
}

const pct = (f: number) => `${Math.round(Math.abs(f) * 100)}%`;
const pontos = (f: number) =>
  `${Math.round(Math.abs(f) * 100)} ponto${Math.round(Math.abs(f) * 100) === 1 ? '' : 's'}`;

/** Frase de uma linha: "o faturamento subiu 12%", "as faltas caíram 3 pontos". */
function frase(l: LinhaComparativo): string {
  const d = INDICADORES_RELATORIO.find((x) => x.chave === l.chave)!;
  const subiu = (l.atual ?? 0) > (l.anterior ?? 0);
  const verbo =
    d.naFrase.startsWith('os ') || d.naFrase.startsWith('as ')
      ? subiu
        ? 'subiram'
        : 'caíram'
      : subiu
        ? 'subiu'
        : 'caiu';
  const quanto =
    l.variacao === null
      ? ''
      : l.formato === 'fracao'
        ? ` ${pontos(l.variacao)}`
        : l.formato === 'nota'
          ? ` ${Math.abs(l.variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`
          : ` ${pct(l.variacao)}`;
  const texto = `${d.naFrase} ${verbo}${quanto}`;
  return texto[0]!.toUpperCase() + texto.slice(1);
}

/** As maiores mudanças de cada lado, em frases (até `max` de cada). */
export function frasesDoMes(
  linhas: readonly LinhaComparativo[],
  max = 4,
): { melhorou: string[]; piorou: string[] } {
  const peso = (l: LinhaComparativo) =>
    l.variacao === null
      ? 1
      : l.formato === 'fracao' || l.formato === 'nota'
        ? Math.abs(l.variacao) * 5
        : Math.abs(l.variacao);
  const de = (t: Tendencia) =>
    linhas
      .filter((l) => l.tendencia === t)
      .sort((a, b) => peso(b) - peso(a))
      .slice(0, max)
      .map(frase);
  return { melhorou: de('melhorou'), piorou: de('piorou') };
}

// ─── Barbeiros: custo, lucro, pontos fortes e fracos ───────────────────────

export interface BarbeiroDoMes {
  profissionalId: string;
  nome: string;
  faturamento: number;
  comissao: number;
  /** Salário ou ajuda de custo do mês (cadastro do profissional). */
  custoFixo: number;
  /** Custo dos produtos usados nos serviços dele. */
  custoProdutos: number;
  atendimentos: number;
  clientes: number;
  ticketMedio: number;
  percentualExtras: number;
  taxaRetorno: number;
  notaMedia: number | null;
  faltas: number;
  servicosMaisFeitos: { nome: string; quantidade: number }[];
  faturamentoAnterior: number;
}

/** O que o barbeiro custa (comissão + fixo) e o lucro que ele gera para a barbearia. */
export function custoELucroDoBarbeiro(b: BarbeiroDoMes): { custo: number; lucro: number } {
  const custo = b.comissao + b.custoFixo;
  return { custo, lucro: b.faturamento - b.custoProdutos - custo };
}

const media = (xs: readonly number[]) =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;

/**
 * Pontos fortes e fracos contra a média da equipe (só quem atendeu no mês): ticket, extras,
 * retorno, nota e faltas. Diferença de 10% ou mais (ou 0,2 na nota) vira frase.
 */
export function pontosDoBarbeiro(
  b: BarbeiroDoMes,
  equipe: readonly BarbeiroDoMes[],
): { fortes: string[]; fracos: string[] } {
  const ativos = equipe.filter((x) => x.clientes > 0);
  const fortes: string[] = [];
  const fracos: string[] = [];
  if (b.clientes === 0 || ativos.length < 2) return { fortes, fracos };
  const comparar = (valor: number, base: number, nome: string, menorMelhor = false) => {
    if (base <= 0) return;
    const dif = (valor - base) / base;
    if (Math.abs(dif) < 0.1) return;
    const acima = dif > 0;
    const texto = `${nome} ${Math.round(Math.abs(dif) * 100)}% ${acima ? 'acima' : 'abaixo'} da média`;
    (acima !== menorMelhor ? fortes : fracos).push(texto);
  };
  comparar(b.ticketMedio, media(ativos.map((x) => x.ticketMedio)), 'Ticket');
  comparar(b.percentualExtras, media(ativos.map((x) => x.percentualExtras)), 'Extras');
  comparar(b.taxaRetorno, media(ativos.map((x) => x.taxaRetorno)), 'Retorno dos clientes');
  comparar(
    b.faltas / Math.max(1, b.clientes + b.faltas),
    media(ativos.map((x) => x.faltas / Math.max(1, x.clientes + x.faltas))),
    'Faltas',
    true,
  );
  const notas = ativos.map((x) => x.notaMedia).filter((n): n is number => n !== null);
  if (b.notaMedia !== null && notas.length >= 2) {
    const dif = b.notaMedia - media(notas);
    if (Math.abs(dif) >= 0.2)
      (dif > 0 ? fortes : fracos).push(
        `Nota ${b.notaMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} (equipe ${media(notas).toLocaleString('pt-BR', { maximumFractionDigits: 1 })})`,
      );
  }
  return { fortes, fracos };
}

// ─── Mix de serviços e produtos ────────────────────────────────────────────

export interface ItemDoMix {
  tipo: 'servico' | 'produto';
  id: string;
  nome: string;
  quantidade: number;
  receita: number;
  /** Receita − custo − comissão; null sem lucro real no plano. */
  lucro: number | null;
}

export interface LinhaMix extends ItemDoMix {
  /** Fração da receita do mês (serviços + produtos). */
  fatiaReceita: number;
  /** Fração da quantidade dentro do tipo (serviço ou produto). */
  fatiaQuantidade: number;
  /** Variação da receita contra o mês anterior; null se não vendeu antes. */
  variacaoReceita: number | null;
}

/** Participação de cada serviço e produto, maior receita primeiro. */
export function mixDoMes(atual: readonly ItemDoMix[], anterior: readonly ItemDoMix[]): LinhaMix[] {
  const receitaTotal = atual.reduce((s, i) => s + i.receita, 0);
  const qtdPorTipo = { servico: 0, produto: 0 };
  for (const i of atual) qtdPorTipo[i.tipo] += i.quantidade;
  const antes = new Map(anterior.map((i) => [`${i.tipo}:${i.id}`, i.receita]));
  return atual
    .map((i) => {
      const r = antes.get(`${i.tipo}:${i.id}`);
      return {
        ...i,
        fatiaReceita: receitaTotal > 0 ? i.receita / receitaTotal : 0,
        fatiaQuantidade: qtdPorTipo[i.tipo] > 0 ? i.quantidade / qtdPorTipo[i.tipo] : 0,
        variacaoReceita: r ? (i.receita - r) / r : null,
      };
    })
    .sort((a, b) => b.receita - a.receita);
}

// ─── Resposta da API ───────────────────────────────────────────────────────

export interface RelatorioDoMes {
  mes: string;
  mesAnterior: string;
  atual: NumerosDoMes;
  anterior: NumerosDoMes;
  barbeiros: BarbeiroDoMes[];
  mixAtual: ItemDoMix[];
  mixAnterior: ItemDoMix[];
  /** Período comparado do mês anterior: no mês corrente, só os mesmos dias (1 a hoje). */
  periodoAnterior: { de: string; ate: string };
  /** Últimos 12 meses (o mais antigo primeiro): faturamento e lucro de cada um. */
  historico: { mes: string; faturamento: number; lucro: number | null }[];
  /** O plano mostra lucro (lucro real) e margem dos itens. */
  verLucro: boolean;
}

/** Mês anterior de um AAAA-MM. */
export function mesAnteriorDe(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

// Indicadores do mês (docs/documentacao-do-produto.md, "Regras de cálculo").
// Tudo sai de comandas FECHADAS: nada é digitado.

export interface ItemFechado {
  tipo: 'servico' | 'produto' | 'nao_operacional';
  servicoId?: string | null;
  produtoId?: string | null;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  ehExtra: boolean;
  pesoAtendimento: number;
  custoUnitario: number;
  comissaoValor: number;
  /** Coberto pelo plano do clube: entra com valor zero (a receita vem da mensalidade). */
  cobertoClube?: boolean;
}

export interface ComandaFechada {
  itens: readonly ItemFechado[];
}

export type GrupoDespesa =
  'fixa' | 'variavel' | 'manutencao' | 'investimento' | 'retirada_dono' | 'cartao_resgate';

export interface DespesaValor {
  grupo: GrupoDespesa;
  valor: number;
}

/** Mensalidades do clube recebidas no período (o que chegou na conta da barbearia). */
export interface ClubeNoPeriodo {
  mensalidades: number;
}

export interface Indicadores {
  /**
   * Serviços + produtos − descontos + mensalidades do clube recebidas no período (decisão do
   * dono, 11/11/2026). Não operacional fica fora.
   */
  faturamento: number;
  receitaServicos: number;
  receitaProdutos: number;
  receitaNaoOperacional: number;
  /** Mensalidades do clube recebidas no período (entram no dia em que são pagas). */
  receitaClube: number;
  /** Comandas fechadas com pelo menos um serviço (assinante conta: ocupou a cadeira). */
  clientes: number;
  /** Clientes que pagaram algum serviço na hora (não só o que o plano cobre). */
  clientesAvulsos: number;
  /** (Serviços + produtos) ÷ clientes avulsos, em centavos: o assinante não puxa para baixo. */
  ticketMedio: number;
  /** Atendimentos cobertos pelo plano do clube (soma do peso). */
  atendimentosClube: number;
  /** Mensalidades ÷ atendimentos do clube: quanto vale cada atendimento do assinante. */
  valorPorAtendimentoClube: number | null;
  /** Soma do peso de atendimento dos serviços. */
  atendimentos: number;
  extrasQuantidade: number;
  extrasValor: number;
  /** Itens extra ÷ clientes (fração). */
  percentualExtras: number;
  comissoes: number;
  custoProdutos: number;
  despesasPorGrupo: Record<GrupoDespesa, number>;
  /** Fixas + variáveis + manutenção + comissões. */
  despesasOperacionais: number;
  /** Despesas operacionais ÷ faturamento (fração). */
  percentualDespesas: number;
  /** Só as comissões ÷ faturamento: a parte de percentualDespesas que é comissão (painel M5). */
  percentualComissoes: number;
  /** Faturamento − despesas operacionais. */
  lucro: number;
}

const valorLiquido = (i: ItemFechado) => i.quantidade * i.precoUnitario - i.desconto;

const GRUPOS: GrupoDespesa[] = [
  'fixa',
  'variavel',
  'manutencao',
  'investimento',
  'retirada_dono',
  'cartao_resgate',
];

export function calcularIndicadores(
  comandas: readonly ComandaFechada[],
  despesas: readonly DespesaValor[] = [],
  clube: ClubeNoPeriodo | null = null,
): Indicadores {
  let receitaServicos = 0;
  let receitaProdutos = 0;
  let receitaNaoOperacional = 0;
  let clientes = 0;
  let clientesAvulsos = 0;
  let atendimentosClube = 0;
  let atendimentos = 0;
  let extrasQuantidade = 0;
  let extrasValor = 0;
  let comissoes = 0;
  let custoProdutos = 0;

  for (const c of comandas) {
    if (c.itens.some((i) => i.tipo === 'servico')) clientes += 1;
    if (c.itens.some((i) => i.tipo === 'servico' && !i.cobertoClube)) clientesAvulsos += 1;
    for (const i of c.itens) {
      const valor = valorLiquido(i);
      if (i.tipo === 'nao_operacional') {
        receitaNaoOperacional += valor;
        continue;
      }
      comissoes += i.comissaoValor;
      custoProdutos += i.quantidade * i.custoUnitario;
      if (i.tipo === 'produto') {
        receitaProdutos += valor;
        continue;
      }
      receitaServicos += valor;
      atendimentos += i.quantidade * i.pesoAtendimento;
      if (i.cobertoClube) atendimentosClube += i.quantidade * i.pesoAtendimento;
      if (i.ehExtra) {
        extrasQuantidade += i.quantidade;
        extrasValor += valor;
      }
    }
  }

  const despesasPorGrupo = Object.fromEntries(GRUPOS.map((g) => [g, 0])) as Record<
    GrupoDespesa,
    number
  >;
  for (const d of despesas) despesasPorGrupo[d.grupo] += d.valor;

  const receitaClube = clube?.mensalidades ?? 0;
  const vendido = receitaServicos + receitaProdutos;
  const faturamento = vendido + receitaClube;
  const despesasOperacionais =
    despesasPorGrupo.fixa + despesasPorGrupo.variavel + despesasPorGrupo.manutencao + comissoes;
  return {
    faturamento,
    receitaServicos,
    receitaProdutos,
    receitaNaoOperacional,
    receitaClube,
    clientes,
    clientesAvulsos,
    ticketMedio: clientesAvulsos > 0 ? Math.round(vendido / clientesAvulsos) : 0,
    atendimentosClube,
    valorPorAtendimentoClube:
      atendimentosClube > 0 && receitaClube > 0
        ? Math.round(receitaClube / atendimentosClube)
        : null,
    atendimentos,
    extrasQuantidade,
    extrasValor,
    percentualExtras: clientes > 0 ? extrasQuantidade / clientes : 0,
    comissoes,
    custoProdutos,
    despesasPorGrupo,
    despesasOperacionais,
    percentualDespesas: faturamento > 0 ? despesasOperacionais / faturamento : 0,
    percentualComissoes: faturamento > 0 ? comissoes / faturamento : 0,
    lucro: faturamento - despesasOperacionais,
  };
}

// ─── Calendário e projeção ────────────────────────────────────────────────

/** Dias de trabalho de um mês (AAAA-MM): dias da semana da unidade, corrigidos pelo calendário. */
export function diasDeTrabalho(
  mes: string,
  diasSemana: readonly number[],
  excecoes: readonly { data: string; trabalha: boolean }[],
): string[] {
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  const total = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const porData = new Map(excecoes.map((e) => [e.data, e.trabalha]));
  const dias: string[] = [];
  for (let d = 1; d <= total; d++) {
    const data = `${mes}-${String(d).padStart(2, '0')}`;
    const normal = diasSemana.includes(new Date(Date.UTC(ano, m - 1, d)).getUTCDay());
    if (porData.get(data) ?? normal) dias.push(data);
  }
  return dias;
}

export interface Projecao {
  diasDoMes: number;
  diasTrabalhados: number;
  /** Faturamento esperado no fim do mês no ritmo atual. */
  projecao: number;
  /** Fração do mês já trabalhada (para a barra de meta). */
  fracaoDoMes: number;
}

/** Projeção = faturamento até hoje ÷ dias trabalhados até hoje × dias de trabalho do mês. */
export function projetar(
  faturamentoAteHoje: number,
  diasDoMes: readonly string[],
  hoje: string,
): Projecao {
  const trabalhados = diasDoMes.filter((d) => d <= hoje).length;
  const total = diasDoMes.length;
  return {
    diasDoMes: total,
    diasTrabalhados: trabalhados,
    projecao:
      trabalhados > 0 ? Math.round((faturamentoAteHoje / trabalhados) * total) : faturamentoAteHoje,
    fracaoDoMes: total > 0 ? trabalhados / total : 0,
  };
}

// ─── Lucratividade por serviço ────────────────────────────────────────────

export interface LucroServico {
  servicoId: string;
  quantidade: number;
  receita: number;
  custoProduto: number;
  comissao: number;
  /** Receita − (custo de produto + comissão). */
  lucro: number;
  /** Lucro ÷ receita (fração). */
  margem: number;
}

export function lucratividadePorServico(comandas: readonly ComandaFechada[]): LucroServico[] {
  const mapa = new Map<string, LucroServico>();
  for (const c of comandas) {
    for (const i of c.itens) {
      if (i.tipo !== 'servico' || !i.servicoId) continue;
      const atual = mapa.get(i.servicoId) ?? {
        servicoId: i.servicoId,
        quantidade: 0,
        receita: 0,
        custoProduto: 0,
        comissao: 0,
        lucro: 0,
        margem: 0,
      };
      atual.quantidade += i.quantidade;
      atual.receita += valorLiquido(i);
      atual.custoProduto += i.quantidade * i.custoUnitario;
      atual.comissao += i.comissaoValor;
      mapa.set(i.servicoId, atual);
    }
  }
  return [...mapa.values()]
    .map((s) => {
      const lucro = s.receita - (s.custoProduto + s.comissao);
      return { ...s, lucro, margem: s.receita > 0 ? lucro / s.receita : 0 };
    })
    .sort((a, b) => b.lucro - a.lucro);
}

// ─── Produtos: o que vende e o que vale a pena ────────────────────────────

/**
 * Onde o produto está, comparado com a mediana dos que venderam no período:
 * investir (vende e rende), divulgar (rende, vende pouco), rever_preco (vende, rende pouco),
 * repensar (nem vende nem rende) e parado (ativo, sem venda no período).
 */
export type SituacaoProduto = 'investir' | 'divulgar' | 'rever_preco' | 'repensar' | 'parado';

export interface LucroProduto {
  produtoId: string;
  quantidade: number;
  receita: number;
  /** Custo de compra do que saiu (quantidade × custo do momento da venda). */
  custo: number;
  comissao: number;
  /** Receita − (custo + comissão). */
  lucro: number;
  /** Lucro ÷ receita (fração). */
  margem: number;
  /** Lucro por real gasto no estoque vendido (lucro ÷ custo); null sem custo cadastrado. */
  retornoSobreCusto: number | null;
  situacao: SituacaoProduto;
}

function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio]! : (v[meio - 1]! + v[meio]!) / 2;
}

/**
 * Lucro de cada produto vendido no período e onde ele fica entre "vende" e "rende".
 * "Rende" é o lucro por unidade vendida (comparável entre produtos baratos e caros);
 * `ativos` entra para mostrar quem não vendeu nada.
 */
export function lucratividadePorProduto(
  comandas: readonly ComandaFechada[],
  ativos: readonly string[] = [],
): LucroProduto[] {
  const mapa = new Map<
    string,
    Omit<LucroProduto, 'lucro' | 'margem' | 'retornoSobreCusto' | 'situacao'>
  >();
  for (const c of comandas) {
    for (const i of c.itens) {
      if (i.tipo !== 'produto' || !i.produtoId) continue;
      const atual = mapa.get(i.produtoId) ?? {
        produtoId: i.produtoId,
        quantidade: 0,
        receita: 0,
        custo: 0,
        comissao: 0,
      };
      atual.quantidade += i.quantidade;
      atual.receita += valorLiquido(i);
      atual.custo += i.quantidade * i.custoUnitario;
      atual.comissao += i.comissaoValor;
      mapa.set(i.produtoId, atual);
    }
  }
  const vendidos = [...mapa.values()].map((p) => {
    const lucro = p.receita - (p.custo + p.comissao);
    return {
      ...p,
      lucro,
      margem: p.receita > 0 ? lucro / p.receita : 0,
      retornoSobreCusto: p.custo > 0 ? lucro / p.custo : null,
    };
  });
  const giro = mediana(vendidos.map((p) => p.quantidade));
  const rende = mediana(vendidos.map((p) => p.lucro / p.quantidade));
  const comSituacao: LucroProduto[] = vendidos.map((p) => {
    const vende = p.quantidade >= giro;
    const bom = p.lucro / p.quantidade >= rende && p.lucro > 0;
    const situacao: SituacaoProduto = vende
      ? bom
        ? 'investir'
        : 'rever_preco'
      : bom
        ? 'divulgar'
        : 'repensar';
    return { ...p, situacao };
  });
  const parados: LucroProduto[] = ativos
    .filter((id) => !mapa.has(id))
    .map((produtoId) => ({
      produtoId,
      quantidade: 0,
      receita: 0,
      custo: 0,
      comissao: 0,
      lucro: 0,
      margem: 0,
      retornoSobreCusto: null,
      situacao: 'parado',
    }));
  return [...comSituacao.sort((a, b) => b.lucro - a.lucro), ...parados];
}

/**
 * Variação entre dois valores (fração); null quando não há base de comparação. Divide pelo
 * valor absoluto: lucro de −10 mil para −13 mil é −30% (piorou), não +30%.
 */
export function variacao(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : (atual - anterior) / Math.abs(anterior);
}

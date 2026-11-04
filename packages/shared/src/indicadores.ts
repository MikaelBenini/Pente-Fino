// Indicadores do mês (docs/documentacao-do-produto.md, "Regras de cálculo").
// Tudo sai de comandas FECHADAS: nada é digitado.

export interface ItemFechado {
  tipo: 'servico' | 'produto' | 'nao_operacional';
  servicoId?: string | null;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  ehExtra: boolean;
  pesoAtendimento: number;
  custoUnitario: number;
  comissaoValor: number;
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

export interface Indicadores {
  /** Serviços + produtos − descontos (não operacional fica fora). */
  faturamento: number;
  receitaServicos: number;
  receitaProdutos: number;
  receitaNaoOperacional: number;
  /** Comandas fechadas com pelo menos um serviço. */
  clientes: number;
  /** Centavos; 0 sem clientes. */
  ticketMedio: number;
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
): Indicadores {
  let receitaServicos = 0;
  let receitaProdutos = 0;
  let receitaNaoOperacional = 0;
  let clientes = 0;
  let atendimentos = 0;
  let extrasQuantidade = 0;
  let extrasValor = 0;
  let comissoes = 0;
  let custoProdutos = 0;

  for (const c of comandas) {
    if (c.itens.some((i) => i.tipo === 'servico')) clientes += 1;
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

  const faturamento = receitaServicos + receitaProdutos;
  const despesasOperacionais =
    despesasPorGrupo.fixa + despesasPorGrupo.variavel + despesasPorGrupo.manutencao + comissoes;
  return {
    faturamento,
    receitaServicos,
    receitaProdutos,
    receitaNaoOperacional,
    clientes,
    ticketMedio: clientes > 0 ? Math.round(faturamento / clientes) : 0,
    atendimentos,
    extrasQuantidade,
    extrasValor,
    percentualExtras: clientes > 0 ? extrasQuantidade / clientes : 0,
    comissoes,
    custoProdutos,
    despesasPorGrupo,
    despesasOperacionais,
    percentualDespesas: faturamento > 0 ? despesasOperacionais / faturamento : 0,
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

/** Variação entre dois valores (fração); null quando não há base de comparação. */
export function variacao(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : (atual - anterior) / anterior;
}

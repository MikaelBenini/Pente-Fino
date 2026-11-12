// Site N3: contas das calculadoras grátis do site (home e /calculadora/*). Dinheiro em centavos,
// percentuais inteiros de 0 a 100. A mesma conta que o sistema faz em cada comanda.

const pct = (v: number) => Math.min(100, Math.max(0, v));

/** Quanto sobra para a casa de cada corte, depois da comissão e do produto. */
export function sobraDoCorte(e: { preco: number; comissaoPct: number; produto: number }) {
  const preco = Math.max(0, e.preco);
  const comissao = Math.round((preco * pct(e.comissaoPct)) / 100);
  const produto = Math.min(Math.max(0, e.produto), preco - comissao);
  return { comissao, produto, sobra: preco - comissao - produto };
}

/**
 * Quanto fica para o barbeiro e para a casa. Com `descontarProduto`, a comissão é calculada
 * sobre o preço menos o produto usado (prática comum para não pagar comissão sobre o custo).
 */
export function comissaoDoBarbeiro(e: {
  preco: number;
  comissaoPct: number;
  produto: number;
  descontarProduto: boolean;
}) {
  const preco = Math.max(0, e.preco);
  const produto = Math.max(0, e.produto);
  const base = e.descontarProduto ? Math.max(0, preco - produto) : preco;
  const barbeiro = Math.round((base * pct(e.comissaoPct)) / 100);
  return { base, barbeiro, produto, casa: preco - barbeiro - produto };
}

/**
 * Preço mínimo do corte para pagar comissão, produto, a parte dos custos fixos e ainda deixar a
 * margem desejada: preço = (produto + fixo ÷ cortes) ÷ (1 − comissão − margem).
 * Sem cortes no mês ou com comissão + margem ≥ 100%, não há preço possível (null).
 */
export function precoMinimoDoCorte(e: {
  custosFixosMes: number;
  cortesMes: number;
  comissaoPct: number;
  produto: number;
  margemPct: number;
}) {
  const sobraPct = 100 - pct(e.comissaoPct) - pct(e.margemPct);
  if (e.cortesMes <= 0 || sobraPct <= 0) return null;
  const fixoPorCorte = Math.round(Math.max(0, e.custosFixosMes) / e.cortesMes);
  const preco = Math.ceil(((Math.max(0, e.produto) + fixoPorCorte) * 100) / sobraPct);
  return {
    preco,
    fixoPorCorte,
    comissao: Math.round((preco * pct(e.comissaoPct)) / 100),
    margem: Math.round((preco * pct(e.margemPct)) / 100),
  };
}

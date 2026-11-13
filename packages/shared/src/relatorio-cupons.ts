// Admin F9: resultado de cada cupom. Quantas contas usaram (cadastro com o cupom), quantas pagam,
// a receita das faturas pagas dessas contas e o desconto concedido nelas, mais o uso por mês de
// cadastro. Contas internas ficam de fora.

export interface ContaParaCupons {
  id: string;
  cupom: string | null;
  /** Desconto do cupom gravado na conta (pontos-base). */
  descontoBp: number;
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  /** ISO. */
  criadaEm: string;
  interna: boolean;
}

export interface FaturaParaCupons {
  contaId: string;
  /** Centavos, já com o desconto. */
  valor: number;
  status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
}

export interface ResultadoDoCupom {
  codigo: string;
  /** Contas que se cadastraram com o cupom. */
  contas: number;
  /** Delas, quantas estão pagando (assinatura ativa). */
  pagantes: number;
  /** Soma das faturas pagas dessas contas (centavos). */
  receita: number;
  /** Quanto deixou de entrar por causa do desconto nas faturas pagas (centavos). */
  desconto: number;
  /** Cadastros com o cupom nos últimos 6 meses (o último é o mês corrente). */
  porMes: { mes: string; contas: number }[];
}

function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a!, m! - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Desconto contido num valor já descontado: valor × bp ÷ (10000 − bp). 100% não tem como saber. */
const descontoDe = (valor: number, bp: number) =>
  bp > 0 && bp < 10000 ? Math.round((valor * bp) / (10000 - bp)) : 0;

export function relatorioCupons(d: {
  codigos: readonly string[];
  contas: readonly ContaParaCupons[];
  faturas: readonly FaturaParaCupons[];
  agora: Date;
}): ResultadoDoCupom[] {
  const mesAtual = d.agora.toISOString().slice(0, 7);
  const meses = Array.from({ length: 6 }, (_, i) => somarMeses(mesAtual, i - 5));
  const pagasPorConta = new Map<string, number[]>();
  for (const f of d.faturas)
    if (f.status === 'paga')
      pagasPorConta.set(f.contaId, [...(pagasPorConta.get(f.contaId) ?? []), f.valor]);
  return d.codigos.map((codigo) => {
    const doCupom = d.contas.filter((c) => !c.interna && c.cupom?.toUpperCase() === codigo);
    let receita = 0;
    let desconto = 0;
    for (const c of doCupom)
      for (const v of pagasPorConta.get(c.id) ?? []) {
        receita += v;
        desconto += descontoDe(v, c.descontoBp);
      }
    return {
      codigo,
      contas: doCupom.length,
      pagantes: doCupom.filter((c) => c.status === 'ativa').length,
      receita,
      desconto,
      porMes: meses.map((mes) => ({
        mes,
        contas: doCupom.filter((c) => c.criadaEm.slice(0, 7) === mes).length,
      })),
    };
  });
}

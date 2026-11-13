// Admin F7: métricas de SaaS da administração, a partir das faturas pagas. O MRR de cada mês vem
// das faturas: a mensal vale no mês do vencimento; a anual vale 1/12 em cada um dos 12 meses a
// partir do vencimento. Só meses fechados (o mês corrente ainda tem fatura por vencer e pareceria
// cancelamento). Contas internas ficam de fora.
import type { PlanoConta } from './planos.js';

export interface ContaParaSaas {
  id: string;
  /** ISO. */
  criadaEm: string;
  interna: boolean;
}

export interface FaturaParaSaas {
  contaId: string;
  plano: PlanoConta;
  ciclo: 'mensal' | 'anual';
  /** Centavos. */
  valor: number;
  status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
  /** AAAA-MM-DD. */
  vencimento: string;
}

export interface MesSaas {
  /** AAAA-MM. */
  mes: string;
  /** Receita recorrente do mês (centavos). */
  mrr: number;
  /** MRR de contas que passaram a pagar neste mês. */
  novo: number;
  /** Aumento de quem já pagava (troca para plano maior, unidade a mais). */
  upgrade: number;
  /** Redução de quem continua pagando. */
  downgrade: number;
  /** MRR de quem pagava no mês anterior e deixou de pagar. */
  perdido: number;
  pagantes: number;
  /** Contas que pagavam no mês anterior e não pagaram neste. */
  cancelaram: number;
  /** cancelaram ÷ pagantes do mês anterior (0 a 1); null sem pagantes antes. */
  churn: number | null;
}

export interface CoorteSaas {
  /** Mês do cadastro, AAAA-MM. */
  mes: string;
  contas: number;
  /** Fatia que pagava em cada mês depois do cadastro (0 = o próprio mês); null = mês ainda aberto. */
  pagando: (number | null)[];
}

export interface MetricasSaas {
  meses: MesSaas[];
  /** MRR médio por conta pagante no último mês fechado (centavos). */
  arpa: number;
  /** Churn mensal médio dos últimos 6 meses fechados (0 a 1); null sem dado. */
  churnMedio: number | null;
  /** Valor do cliente no tempo: ARPA ÷ churn médio (centavos); null sem churn medido. */
  ltv: number | null;
  /** MRR e contas por plano no último mês fechado. */
  porPlano: Record<PlanoConta, { mrr: number; contas: number }>;
  coortes: CoorteSaas[];
}

const mesDe = (iso: string) => iso.slice(0, 7);
function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a!, m! - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** MRR por conta e mês (e o plano), só das faturas pagas. */
function mrrPorContaEMes(faturas: readonly FaturaParaSaas[], fora: Set<string>) {
  const valor = new Map<string, Map<string, number>>();
  const plano = new Map<string, Map<string, PlanoConta>>();
  for (const f of faturas) {
    if (f.status !== 'paga' || fora.has(f.contaId)) continue;
    const meses = f.ciclo === 'anual' ? 12 : 1;
    const porMes = Math.round(f.valor / meses);
    for (let i = 0; i < meses; i++) {
      const mes = somarMeses(mesDe(f.vencimento), i);
      const v = valor.get(f.contaId) ?? new Map<string, number>();
      v.set(mes, (v.get(mes) ?? 0) + porMes);
      valor.set(f.contaId, v);
      const p = plano.get(f.contaId) ?? new Map<string, PlanoConta>();
      p.set(mes, f.plano);
      plano.set(f.contaId, p);
    }
  }
  return { valor, plano };
}

/**
 * Métricas de SaaS dos últimos `quantos` meses fechados (o mês corrente não entra) e as coortes
 * dos últimos 6 meses de cadastro.
 */
export function metricasSaas(d: {
  contas: readonly ContaParaSaas[];
  faturas: readonly FaturaParaSaas[];
  agora: Date;
  quantos?: number;
}): MetricasSaas {
  const quantos = d.quantos ?? 12;
  const fora = new Set(d.contas.filter((c) => c.interna).map((c) => c.id));
  const { valor, plano } = mrrPorContaEMes(d.faturas, fora);
  const mrr = (conta: string, mes: string) => valor.get(conta)?.get(mes) ?? 0;
  const contasComFatura = [...valor.keys()];
  const ultimo = somarMeses(d.agora.toISOString().slice(0, 7), -1);

  const meses: MesSaas[] = [];
  for (let i = quantos - 1; i >= 0; i--) {
    const mes = somarMeses(ultimo, -i);
    const antes = somarMeses(mes, -1);
    const m: MesSaas = {
      mes,
      mrr: 0,
      novo: 0,
      upgrade: 0,
      downgrade: 0,
      perdido: 0,
      pagantes: 0,
      cancelaram: 0,
      churn: null,
    };
    let pagantesAntes = 0;
    for (const c of contasComFatura) {
      const agora = mrr(c, mes);
      const ant = mrr(c, antes);
      m.mrr += agora;
      if (agora > 0) m.pagantes++;
      if (ant > 0) pagantesAntes++;
      if (ant === 0 && agora > 0) m.novo += agora;
      else if (ant > 0 && agora === 0) {
        m.perdido += ant;
        m.cancelaram++;
      } else if (agora > ant) m.upgrade += agora - ant;
      else if (agora < ant) m.downgrade += ant - agora;
    }
    m.churn = pagantesAntes ? m.cancelaram / pagantesAntes : null;
    meses.push(m);
  }

  const fechado = meses.at(-1)!;
  const arpa = fechado.pagantes ? Math.round(fechado.mrr / fechado.pagantes) : 0;
  const churns = meses
    .slice(-6)
    .map((m) => m.churn)
    .filter((c): c is number => c !== null);
  const churnMedio = churns.length ? churns.reduce((s, c) => s + c, 0) / churns.length : null;
  const ltv = churnMedio ? Math.round(arpa / churnMedio) : null;

  const porPlano: MetricasSaas['porPlano'] = {
    basico: { mrr: 0, contas: 0 },
    pro: { mrr: 0, contas: 0 },
    premium: { mrr: 0, contas: 0 },
  };
  for (const c of contasComFatura) {
    const v = mrr(c, fechado.mes);
    const p = plano.get(c)?.get(fechado.mes);
    if (v > 0 && p) {
      porPlano[p].mrr += v;
      porPlano[p].contas++;
    }
  }

  // Coortes: contas criadas em cada mês (sem as internas) e quantas pagavam depois.
  const coortes: CoorteSaas[] = [];
  for (let i = 5; i >= 0; i--) {
    const mes = somarMeses(ultimo, -i);
    const doMes = d.contas.filter((c) => !c.interna && mesDe(c.criadaEm) === mes);
    coortes.push({
      mes,
      contas: doMes.length,
      pagando: Array.from({ length: 6 }, (_, k) => {
        const alvo = somarMeses(mes, k);
        if (alvo > ultimo) return null;
        if (!doMes.length) return 0;
        return doMes.filter((c) => mrr(c.id, alvo) > 0).length / doMes.length;
      }),
    });
  }

  return { meses, arpa, churnMedio, ltv, porPlano, coortes };
}

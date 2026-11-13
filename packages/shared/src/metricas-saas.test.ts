import { describe, expect, it } from 'vitest';
import { metricasSaas, type FaturaParaSaas } from './metricas-saas.js';

const agora = new Date('2026-11-20T15:00:00Z'); // último mês fechado: 2026-10
const paga = (
  contaId: string,
  vencimento: string,
  valor: number,
  o: Partial<FaturaParaSaas> = {},
): FaturaParaSaas => ({
  contaId,
  plano: 'pro',
  ciclo: 'mensal',
  valor,
  status: 'paga',
  vencimento,
  ...o,
});

describe('metricasSaas (admin F7)', () => {
  const contas = [
    { id: 'a', criadaEm: '2026-08-02T12:00:00Z', interna: false },
    { id: 'b', criadaEm: '2026-08-10T12:00:00Z', interna: false },
    { id: 'c', criadaEm: '2026-09-05T12:00:00Z', interna: false },
    { id: 'int', criadaEm: '2026-08-01T12:00:00Z', interna: true },
  ];
  const faturas = [
    // a: Pro em agosto e setembro, Premium em outubro (upgrade).
    paga('a', '2026-08-05', 14990),
    paga('a', '2026-09-05', 14990),
    paga('a', '2026-10-05', 24990, { plano: 'premium' }),
    // b: pagou agosto e setembro, cancelou em outubro.
    paga('b', '2026-08-12', 7990, { plano: 'basico' }),
    paga('b', '2026-09-12', 7990, { plano: 'basico' }),
    // c: anual em setembro (R$ 1.200 = R$ 100/mês por 12 meses).
    paga('c', '2026-09-10', 120000, { ciclo: 'anual' }),
    // Fatura aberta não conta; conta interna não conta.
    paga('a', '2026-10-20', 9999, { status: 'aberta' }),
    paga('int', '2026-10-01', 50000),
  ];
  const m = metricasSaas({ contas, faturas, agora, quantos: 3 });

  it('MRR por mês fechado com novo, upgrade, perdido e churn (o mês corrente não entra)', () => {
    expect(m.meses.map((x) => x.mes)).toEqual(['2026-08', '2026-09', '2026-10']);
    const [ago, set, out] = m.meses;
    expect(ago).toMatchObject({ mrr: 22980, novo: 22980, pagantes: 2, churn: null });
    expect(set).toMatchObject({ mrr: 32980, novo: 10000, pagantes: 3, cancelaram: 0, churn: 0 });
    expect(out).toMatchObject({
      mrr: 34990,
      upgrade: 10000,
      perdido: 7990,
      pagantes: 2,
      cancelaram: 1,
    });
    expect(out!.churn).toBeCloseTo(1 / 3);
  });

  it('ARPA, churn médio, LTV e MRR por plano no último mês fechado', () => {
    expect(m.arpa).toBe(17495); // 34990 ÷ 2
    expect(m.churnMedio).toBeCloseTo((0 + 1 / 3) / 2);
    expect(m.ltv).toBe(Math.round(17495 / ((0 + 1 / 3) / 2)));
    expect(m.porPlano.premium).toEqual({ mrr: 24990, contas: 1 });
    expect(m.porPlano.pro).toEqual({ mrr: 10000, contas: 1 });
    expect(m.porPlano.basico).toEqual({ mrr: 0, contas: 0 });
  });

  it('coortes: fatia que pagava em cada mês depois do cadastro; mês ainda aberto é null', () => {
    const agosto = m.coortes.find((c) => c.mes === '2026-08')!;
    expect(agosto.contas).toBe(2); // a interna não entra
    expect(agosto.pagando.slice(0, 4)).toEqual([1, 1, 0.5, null]);
    const setembro = m.coortes.find((c) => c.mes === '2026-09')!;
    expect(setembro.pagando.slice(0, 3)).toEqual([1, 1, null]);
  });

  it('sem faturas: zeros, sem churn nem LTV', () => {
    const vazio = metricasSaas({ contas: [], faturas: [], agora, quantos: 2 });
    expect(vazio.meses.every((x) => x.mrr === 0 && x.churn === null)).toBe(true);
    expect(vazio).toMatchObject({ arpa: 0, churnMedio: null, ltv: null });
  });
});

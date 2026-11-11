import { describe, expect, it } from 'vitest';
import { proximaCobrancaManual } from './cobranca-manual.js';

const base = { plano: 'pro' as const, ciclo: 'mensal' as const, unidades: 1 };

describe('cobrança manual', () => {
  it('nasce 7 dias antes do fim do período pago, com o próximo período e o valor do plano', () => {
    const faturas = [{ status: 'paga' as const, periodoFim: '2026-12-04' }];
    expect(proximaCobrancaManual({ ...base, faturas, hoje: '2026-11-26' })).toBeNull();
    expect(proximaCobrancaManual({ ...base, faturas, hoje: '2026-11-28' })).toEqual({
      vencimento: '2026-12-05',
      periodoInicio: '2026-12-05',
      periodoFim: '2027-01-04',
      valor: 14990,
    });
  });

  it('não repete se já há cobrança em aberto; sem pagamento, nada (é o teste)', () => {
    expect(
      proximaCobrancaManual({
        ...base,
        hoje: '2026-12-01',
        faturas: [
          { status: 'paga', periodoFim: '2026-12-04' },
          { status: 'aberta', periodoFim: '2027-01-04' },
        ],
      }),
    ).toBeNull();
    expect(proximaCobrancaManual({ ...base, hoje: '2026-12-01', faturas: [] })).toBeNull();
  });

  it('anual: período de um ano, com as unidades extras', () => {
    const c = proximaCobrancaManual({
      plano: 'premium',
      ciclo: 'anual',
      unidades: 2,
      hoje: '2027-11-01',
      faturas: [{ status: 'paga', periodoFim: '2027-11-04' }],
    })!;
    expect(c).toMatchObject({ periodoFim: '2028-11-04', valor: (20790 + 8290) * 12 });
  });

  // Admin R4: conta ativa que nunca pagou ficava sem cobrança nenhuma ("Vence em 7 dias R$ 0").
  it('ativa sem pagamento com data de início: a primeira cobrança vence nessa data', () => {
    const r = { ...base, faturas: [], cobrarAPartirDe: '2026-11-15' };
    expect(proximaCobrancaManual({ ...r, hoje: '2026-11-07' })).toBeNull();
    expect(proximaCobrancaManual({ ...r, hoje: '2026-11-08' })).toEqual({
      vencimento: '2026-11-15',
      periodoInicio: '2026-11-15',
      periodoFim: '2026-12-14',
      valor: 14990,
    });
  });

  it('cortesia: nada durante; a cobrança começa no dia seguinte ao fim', () => {
    const r = {
      ...base,
      faturas: [{ status: 'paga' as const, periodoFim: '2026-11-30' }],
      cortesiaAte: '2027-01-31',
      cobrarAPartirDe: '2027-02-01',
    };
    expect(proximaCobrancaManual({ ...r, hoje: '2026-11-28' })).toBeNull();
    expect(proximaCobrancaManual({ ...r, hoje: '2027-01-26' })).toMatchObject({
      vencimento: '2027-02-01',
    });
  });

  it('reativada com início depois do último período pago: vale a data de início', () => {
    expect(
      proximaCobrancaManual({
        ...base,
        hoje: '2026-11-11',
        faturas: [{ status: 'paga', periodoFim: '2026-06-30' }],
        cobrarAPartirDe: '2026-11-12',
      }),
    ).toMatchObject({ vencimento: '2026-11-12' });
  });
});

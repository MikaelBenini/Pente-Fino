import { describe, expect, it } from 'vitest';
import { emailCobrancaManual, proximaCobrancaManual } from './cobranca-manual.js';

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

  it('anual: período de um ano; o e-mail diz quando e quanto', () => {
    const c = proximaCobrancaManual({
      plano: 'premium',
      ciclo: 'anual',
      unidades: 2,
      hoje: '2027-11-01',
      faturas: [{ status: 'paga', periodoFim: '2027-11-04' }],
    })!;
    expect(c).toMatchObject({ periodoFim: '2028-11-04', valor: (20790 + 8290) * 12 });
    const e = emailCobrancaManual({ nome: 'Rui Rua', conta: 'Barbearia da Rua', cobranca: c });
    expect(e.assunto).toBe('Mensalidade do Pente Fino vence em 05/11');
    expect(e.texto).toMatch(/^Oi, Rui\./);
  });
});

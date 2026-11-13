import { describe, expect, it } from 'vitest';
import { relatorioCupons, type ContaParaCupons } from './relatorio-cupons.js';

const agora = new Date('2026-11-20T15:00:00Z');
const conta = (id: string, o: Partial<ContaParaCupons>): ContaParaCupons => ({
  id,
  cupom: 'LANCAMENTO',
  descontoBp: 3000,
  status: 'ativa',
  criadaEm: '2026-11-05T12:00:00Z',
  interna: false,
  ...o,
});

describe('relatorioCupons (admin F9)', () => {
  const r = relatorioCupons({
    codigos: ['LANCAMENTO', 'FUNDADOR'],
    agora,
    contas: [
      conta('a', {}),
      conta('b', { status: 'teste', criadaEm: '2026-10-10T12:00:00Z' }),
      conta('c', { cupom: 'lancamento', status: 'cancelada', criadaEm: '2026-09-01T12:00:00Z' }),
      conta('int', { interna: true }),
      conta('sem', { cupom: null }),
    ],
    faturas: [
      // R$ 104,93 pago com 30% de desconto: o cheio seria R$ 149,90 (desconto R$ 44,97).
      { contaId: 'a', valor: 10493, status: 'paga' },
      { contaId: 'a', valor: 10493, status: 'aberta' },
      { contaId: 'c', valor: 10493, status: 'paga' },
      { contaId: 'int', valor: 99999, status: 'paga' },
    ],
  });

  it('contas, pagantes, receita das faturas pagas e o desconto concedido; sem as internas', () => {
    expect(r[0]).toMatchObject({
      codigo: 'LANCAMENTO',
      contas: 3, // código sem diferença de maiúsculas
      pagantes: 1,
      receita: 20986,
      desconto: 2 * 4497,
    });
  });

  it('uso por mês de cadastro nos últimos 6 meses', () => {
    expect(r[0]!.porMes.map((m) => m.mes)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(r[0]!.porMes.map((m) => m.contas)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('cupom sem uso: zeros', () => {
    expect(r[1]).toMatchObject({
      codigo: 'FUNDADOR',
      contas: 0,
      pagantes: 0,
      receita: 0,
      desconto: 0,
    });
  });
});

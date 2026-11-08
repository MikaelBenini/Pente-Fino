import { describe, expect, it } from 'vitest';
import { decidirLimpezaDaConta, type ContaParaLimpeza } from './limpeza.js';

// Meio-dia em São Paulo, para o dia de calendário não depender do fuso da máquina.
const dia = (d: string) => new Date(`${d}T15:00:00Z`);
const base: ContaParaLimpeza = {
  status: 'teste',
  criadoEm: dia('2026-11-01'),
  testeAte: dia('2026-11-15'),
  canceladaEm: null,
  temPagamento: false,
  donoSemConfirmar: false,
};

describe('limpeza da conta', () => {
  it('sem confirmar o e-mail: aviso 2 dias antes e sai no 7º dia', () => {
    const c = { ...base, donoSemConfirmar: true };
    expect(decidirLimpezaDaConta(c, dia('2026-11-04'))).toEqual({ tipo: 'manter' });
    expect(decidirLimpezaDaConta(c, dia('2026-11-06'))).toEqual({
      tipo: 'avisar',
      motivo: 'sem_confirmar',
      dias: 2,
      apagaEm: '2026-11-08',
    });
    expect(decidirLimpezaDaConta(c, dia('2026-11-08'))).toEqual({
      tipo: 'apagar',
      motivo: 'sem_confirmar',
    });
    // A rotina não rodou no dia: sai depois mesmo assim.
    expect(decidirLimpezaDaConta(c, dia('2026-11-20')).tipo).toBe('apagar');
    // Pagou sem confirmar: fica.
    expect(decidirLimpezaDaConta({ ...c, temPagamento: true }, dia('2026-11-20')).tipo).toBe(
      'manter',
    );
  });

  it('teste vencido sem pagamento: avisos 15 e 3 dias antes, sai 90 dias depois', () => {
    // Fim do teste em 15/11 → sai em 13/02/2027.
    expect(decidirLimpezaDaConta(base, dia('2026-11-20'))).toEqual({ tipo: 'manter' });
    expect(decidirLimpezaDaConta(base, dia('2027-01-29'))).toMatchObject({
      tipo: 'avisar',
      dias: 15,
      apagaEm: '2027-02-13',
    });
    expect(decidirLimpezaDaConta(base, dia('2027-02-10'))).toMatchObject({
      tipo: 'avisar',
      dias: 3,
    });
    expect(decidirLimpezaDaConta(base, dia('2027-02-13'))).toEqual({
      tipo: 'apagar',
      motivo: 'parada',
    });
    // Teste ainda valendo ou conta paga: fica.
    expect(decidirLimpezaDaConta(base, dia('2026-11-10')).tipo).toBe('manter');
    expect(
      decidirLimpezaDaConta({ ...base, status: 'ativa', temPagamento: true }, dia('2028-01-01'))
        .tipo,
    ).toBe('manter');
  });

  it('cancelada (mesmo tendo pago): 90 dias depois do cancelamento; suspensa fica', () => {
    const c: ContaParaLimpeza = {
      ...base,
      status: 'cancelada',
      canceladaEm: dia('2026-12-01'),
      temPagamento: true,
    };
    expect(decidirLimpezaDaConta(c, dia('2027-02-26'))).toMatchObject({ tipo: 'avisar', dias: 3 });
    expect(decidirLimpezaDaConta(c, dia('2027-03-01')).tipo).toBe('apagar');
    expect(decidirLimpezaDaConta({ ...base, status: 'suspensa' }, dia('2028-01-01')).tipo).toBe(
      'manter',
    );
  });
});

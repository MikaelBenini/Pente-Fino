import { describe, expect, it } from 'vitest';
import { dataDeApagarConta, decidirLimpezaDaConta, type ContaParaLimpeza } from './limpeza.js';

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

describe('data de apagar a conta (admin U9)', () => {
  const agora = new Date('2026-11-20T15:00:00Z');
  const base = {
    status: 'teste' as const,
    criadoEm: new Date('2026-10-01T12:00:00Z'),
    testeAte: new Date('2026-10-15T12:00:00Z'),
    canceladaEm: null,
    temPagamento: false,
    donoSemConfirmar: false,
  };
  it('teste vencido sem pagamento: 90 dias depois do fim do teste', () => {
    expect(dataDeApagarConta(base, agora)).toEqual({ motivo: 'parada', apagaEm: '2027-01-13' });
  });
  it('sem confirmar o e-mail: 7 dias depois do cadastro', () => {
    expect(dataDeApagarConta({ ...base, donoSemConfirmar: true }, agora)).toEqual({
      motivo: 'sem_confirmar',
      apagaEm: '2026-10-08',
    });
  });
  it('cancelada: 90 dias depois do cancelamento, mesmo tendo pago', () => {
    expect(
      dataDeApagarConta(
        {
          ...base,
          status: 'cancelada',
          canceladaEm: new Date('2026-11-01T12:00:00Z'),
          temPagamento: true,
        },
        agora,
      ),
    ).toEqual({ motivo: 'parada', apagaEm: '2027-01-30' });
  });
  it('pagante e cortesia (ativa) nunca entram', () => {
    expect(dataDeApagarConta({ ...base, temPagamento: true }, agora)).toBeNull();
    expect(dataDeApagarConta({ ...base, status: 'ativa', testeAte: null }, agora)).toBeNull();
  });
  it('bate com a decisão do dia: no dia de apagar, as duas dizem apagar', () => {
    const dia = new Date('2027-01-13T15:00:00Z');
    expect(decidirLimpezaDaConta(base, dia)).toMatchObject({ tipo: 'apagar' });
    expect(dataDeApagarConta(base, dia)?.apagaEm).toBe('2027-01-13');
  });
});

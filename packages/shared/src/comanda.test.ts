import { describe, expect, it } from 'vitest';
import { horariosLivres, instanteLocal } from './agenda.js';
import {
  faltaReceber,
  podeAgirNaComanda,
  ratearDesconto,
  statusEfetivo,
  totaisComanda,
} from './comanda.js';

describe('podeAgirNaComanda', () => {
  it('barbeiro confirma a própria, não a dos outros', () => {
    expect(podeAgirNaComanda('confirmar', 'em_atendimento', ['barbeiro'], true).permitido).toBe(
      true,
    );
    expect(podeAgirNaComanda('confirmar', 'em_atendimento', ['barbeiro'], false)).toEqual({
      permitido: false,
      motivo: 'Você só mexe nas suas comandas.',
    });
  });

  it('barbeiro não fecha nem reabre', () => {
    expect(podeAgirNaComanda('fechar', 'confirmada', ['barbeiro'], true).permitido).toBe(false);
    expect(podeAgirNaComanda('reabrir', 'fechada', ['barbeiro'], true).permitido).toBe(false);
  });

  it('recepção fecha confirmada, mas pendente só com gestor', () => {
    expect(podeAgirNaComanda('fechar', 'confirmada', ['recepcao'], false).permitido).toBe(true);
    expect(podeAgirNaComanda('fechar', 'pendente', ['recepcao'], false).motivo).toMatch(
      /ainda não confirmou/,
    );
    expect(podeAgirNaComanda('fechar', 'pendente', ['gestor'], false).permitido).toBe(true);
  });

  it('reabrir só fechada, só dono ou gestor', () => {
    expect(podeAgirNaComanda('reabrir', 'fechada', ['recepcao'], false).permitido).toBe(false);
    expect(podeAgirNaComanda('reabrir', 'fechada', ['dono'], false).permitido).toBe(true);
    expect(podeAgirNaComanda('reabrir', 'confirmada', ['dono'], false).motivo).toMatch(
      /comanda confirmada/,
    );
  });

  it('itens: barbeiro não mexe depois de confirmar; ninguém mexe em fechada', () => {
    expect(podeAgirNaComanda('editar_itens', 'confirmada', ['barbeiro'], true).permitido).toBe(
      false,
    );
    expect(podeAgirNaComanda('editar_itens', 'confirmada', ['recepcao'], false).permitido).toBe(
      true,
    );
    expect(podeAgirNaComanda('editar_itens', 'fechada', ['dono'], false).permitido).toBe(false);
  });

  it('cancelada não volta', () => {
    for (const acao of ['iniciar', 'confirmar', 'fechar', 'reabrir'] as const) {
      expect(podeAgirNaComanda(acao, 'cancelada', ['dono'], false).permitido).toBe(false);
    }
  });
});

describe('statusEfetivo', () => {
  const fim = new Date('2026-11-04T13:00:00Z');
  it('vira pendente 15 minutos depois do fim sem confirmação', () => {
    expect(statusEfetivo('em_atendimento', fim, new Date('2026-11-04T13:14:00Z'))).toBe(
      'em_atendimento',
    );
    expect(statusEfetivo('em_atendimento', fim, new Date('2026-11-04T13:16:00Z'))).toBe('pendente');
    expect(statusEfetivo('prevista', fim, new Date('2026-11-04T14:00:00Z'))).toBe('pendente');
  });
  it('confirmada e fechada não mudam; comanda sem horário também não', () => {
    expect(statusEfetivo('confirmada', fim, new Date('2026-11-05T00:00:00Z'))).toBe('confirmada');
    expect(statusEfetivo('em_atendimento', null, new Date('2030-01-01T00:00:00Z'))).toBe(
      'em_atendimento',
    );
  });
});

describe('totais e desconto', () => {
  const itens = [
    { quantidade: 1, precoUnitario: 5000, desconto: 0 },
    { quantidade: 1, precoUnitario: 1500, desconto: 0 },
    { quantidade: 2, precoUnitario: 1750, desconto: 0 },
  ];

  it('soma bruto, desconto e líquido', () => {
    expect(totaisComanda([{ quantidade: 2, precoUnitario: 3500, desconto: 500 }])).toEqual({
      totalBruto: 7000,
      desconto: 500,
      totalLiquido: 6500,
    });
  });

  it('rateia o desconto proporcional e fecha exato no centavo', () => {
    const r = ratearDesconto(itens, 1000);
    expect(r.map((i) => i.desconto)).toEqual([500, 150, 350]);
    expect(totaisComanda(r).desconto).toBe(1000);
  });

  it('sobra de arredondamento vai para o maior item', () => {
    const r = ratearDesconto(
      [
        { quantidade: 1, precoUnitario: 1000, desconto: 0 },
        { quantidade: 1, precoUnitario: 1000, desconto: 0 },
        { quantidade: 1, precoUnitario: 1000, desconto: 0 },
      ],
      100,
    );
    expect(r.map((i) => i.desconto).reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.map((i) => i.desconto).sort()).toEqual([33, 33, 34]);
  });

  it('não deixa desconto maior que o total', () => {
    expect(() => ratearDesconto(itens, 999_999)).toThrow(RangeError);
  });

  it('falta receber', () => {
    expect(faltaReceber(7000, [{ valor: 5000 }, { valor: 1500 }])).toBe(500);
    expect(faltaReceber(7000, [{ valor: 7000 }])).toBe(0);
  });
});

describe('horariosLivres', () => {
  const dia = '2026-11-04';
  const expediente = [{ inicio: instanteLocal(dia, 9 * 60), fim: instanteLocal(dia, 12 * 60) }];

  it('oferece horários que cabem inteiros no turno', () => {
    const r = horariosLivres({ expediente, ocupados: [], duracaoMin: 60, passoMin: 60 });
    expect(r.map((d) => d.toISOString())).toEqual([
      '2026-11-04T12:00:00.000Z',
      '2026-11-04T13:00:00.000Z',
      '2026-11-04T14:00:00.000Z',
    ]);
  });

  it('pula o ocupado e o que já passou', () => {
    const ocupados = [
      { inicio: instanteLocal(dia, 10 * 60), fim: instanteLocal(dia, 10 * 60 + 30) },
    ];
    const r = horariosLivres({
      expediente,
      ocupados,
      duracaoMin: 30,
      passoMin: 30,
      agora: instanteLocal(dia, 9 * 60 + 10),
    });
    expect(r.map((d) => d.toISOString())).toEqual([
      '2026-11-04T12:30:00.000Z',
      '2026-11-04T13:30:00.000Z',
      '2026-11-04T14:00:00.000Z',
      '2026-11-04T14:30:00.000Z',
    ]);
  });

  it('serviço maior que o turno não cabe', () => {
    expect(horariosLivres({ expediente, ocupados: [], duracaoMin: 240 })).toEqual([]);
  });
});

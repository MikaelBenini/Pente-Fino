import { describe, expect, it } from 'vitest';
import { extremosDoMapa, mapaDeOcupacao } from './ocupacao.js';

// Terça, 01/12/2026: dois barbeiros das 9h às 12h; a unidade tem 1 cadeira só.
const dia = '2026-12-01';
const h = (hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`);
const turnos = [{ diaSemana: 2, inicioMin: 9 * 60, fimMin: 12 * 60 }];

describe('mapa de ocupação', () => {
  it('limita o disponível às cadeiras e soma o marcado hora a hora', () => {
    const m = mapaDeOcupacao({
      dias: [dia],
      capacidade: 1,
      profissionais: [
        { turnos, bloqueios: [], agendados: [{ inicio: h('09:00'), fim: h('10:00') }] },
        { turnos, bloqueios: [], agendados: [{ inicio: h('10:00'), fim: h('10:30') }] },
      ],
    });
    // 3 horas de 1 cadeira = 180 min disponíveis; marcados 60 + 30.
    expect(m.total).toEqual({ disponivelMin: 180, agendadoMin: 90, fracao: 0.5 });
    expect(m.celulas.map((c) => [c.hora, c.fracao])).toEqual([
      [9, 1],
      [10, 0.5],
      [11, 0],
    ]);
    expect(m.porFaixa).toEqual([{ faixa: 'manha', ocupacao: m.total }]);
  });

  it('com duas cadeiras, os dois barbeiros contam; bloqueio sai do disponível', () => {
    const m = mapaDeOcupacao({
      dias: [dia],
      capacidade: 2,
      profissionais: [
        { turnos, bloqueios: [{ inicio: h('11:00'), fim: h('12:00') }], agendados: [] },
        { turnos, bloqueios: [], agendados: [{ inicio: h('11:00'), fim: h('12:00') }] },
      ],
    });
    expect(m.total.disponivelMin).toBe(300); // 180 + 120
    expect(m.celulas.find((c) => c.hora === 11)).toMatchObject({
      disponivelMin: 60,
      agendadoMin: 60,
      fracao: 1,
    });
  });

  it('as horas mais vazias e mais cheias', () => {
    const celulas = [
      { diaSemana: 2, hora: 9, disponivelMin: 240, agendadoMin: 240, fracao: 1 },
      { diaSemana: 2, hora: 10, disponivelMin: 240, agendadoMin: 60, fracao: 0.25 },
      { diaSemana: 2, hora: 11, disponivelMin: 60, agendadoMin: 0, fracao: 0 },
    ];
    const e = extremosDoMapa(celulas, 1);
    expect(e.maisVazias[0]?.hora).toBe(10); // a das 11h tem pouco expediente no período
    expect(e.maisCheias[0]?.hora).toBe(9);
  });
});

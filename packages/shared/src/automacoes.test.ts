import { describe, expect, it } from 'vitest';
import {
  deveConvidarRetorno,
  ehAniversario,
  intervaloHabitual,
  lerAutomacoes,
} from './automacoes.js';

const d = (s: string) => new Date(`${s}T15:00:00Z`);

describe('intervalo habitual', () => {
  it('mediana das últimas visitas; poucas visitas usam o padrão; limites de 14 a 120', () => {
    expect(intervaloHabitual([d('2026-11-01')], 30)).toBe(30);
    expect(
      intervaloHabitual([d('2026-09-01'), d('2026-09-22'), d('2026-10-13'), d('2026-11-24')], 30),
    ).toBe(21);
    expect(intervaloHabitual([d('2026-11-01'), d('2026-11-05')], 30)).toBe(14);
    expect(intervaloHabitual([d('2025-01-01'), d('2026-01-01')], 30)).toBe(120);
  });
});

describe('convite de retorno', () => {
  const base = {
    ultimaVisita: d('2026-10-01'),
    intervaloDias: 30,
    convidadoEm: null,
    temHorarioMarcado: false,
    agora: d('2026-11-01'),
  };
  it('passou do intervalo: convida uma vez por ciclo; com horário marcado, não', () => {
    expect(deveConvidarRetorno(base)).toBe(true);
    expect(deveConvidarRetorno({ ...base, agora: d('2026-10-20') })).toBe(false);
    expect(deveConvidarRetorno({ ...base, temHorarioMarcado: true })).toBe(false);
    expect(deveConvidarRetorno({ ...base, convidadoEm: d('2026-10-31') })).toBe(false);
    // Convidado no ciclo anterior (antes da última visita): pode de novo.
    expect(deveConvidarRetorno({ ...base, convidadoEm: d('2026-09-15') })).toBe(true);
  });
});

describe('aniversário', () => {
  it('mesmo dia e mês; 29/02 cai em 28/02 nos anos sem 29', () => {
    expect(ehAniversario('1990-11-06', '2026-11-06')).toBe(true);
    expect(ehAniversario('1990-11-07', '2026-11-06')).toBe(false);
    expect(ehAniversario('2000-02-29', '2027-02-28')).toBe(true);
    expect(ehAniversario('2000-02-29', '2028-02-28')).toBe(false);
  });
});

it('automações começam desligadas e o que está gravado vale', () => {
  expect(lerAutomacoes(null)).toEqual({
    retorno: false,
    retornoDiasPadrao: 30,
    aniversario: false,
  });
  expect(lerAutomacoes({ retorno: true })).toMatchObject({ retorno: true, aniversario: false });
});

import { describe, expect, it } from 'vitest';
import {
  bloqueadoPorFaltas,
  lerRegrasAgendamento,
  REGRAS_AGENDAMENTO_PADRAO,
  regrasAgendamentoSchema,
} from './regras-agendamento.js';

describe('regras de agendamento', () => {
  it('unidade sem regra gravada usa o padrão; gravado parcial completa com o padrão', () => {
    expect(lerRegrasAgendamento(null)).toEqual(REGRAS_AGENDAMENTO_PADRAO);
    // Regras gravadas antes das faltas: ficam no padrão (3 em 90 dias).
    expect(lerRegrasAgendamento({ maxFuturos: 1 })).toMatchObject({
      maxFuturos: 1,
      faltasParaBloquear: 3,
      faltasJanelaDias: 90,
    });
    expect(bloqueadoPorFaltas(3, REGRAS_AGENDAMENTO_PADRAO)).toBe(true);
    expect(bloqueadoPorFaltas(2, REGRAS_AGENDAMENTO_PADRAO)).toBe(false);
    expect(bloqueadoPorFaltas(9, { ...REGRAS_AGENDAMENTO_PADRAO, faltasParaBloquear: 0 })).toBe(
      false,
    );
    expect(lerRegrasAgendamento({ janelaDias: 30, lembretesHoras: [] })).toEqual({
      ...REGRAS_AGENDAMENTO_PADRAO,
      janelaDias: 30,
      lembretesHoras: [],
    });
  });

  it('valor inválido gravado não derruba: volta ao padrão', () => {
    expect(lerRegrasAgendamento({ janelaDias: -3 })).toEqual(REGRAS_AGENDAMENTO_PADRAO);
  });

  it('lembretes: no máximo dois, sem repetir, o maior primeiro', () => {
    const ok = regrasAgendamentoSchema.parse({
      ...REGRAS_AGENDAMENTO_PADRAO,
      lembretesHoras: [3, 48],
    });
    expect(ok.lembretesHoras).toEqual([48, 3]);
    expect(
      regrasAgendamentoSchema.safeParse({ ...REGRAS_AGENDAMENTO_PADRAO, lembretesHoras: [2, 2] })
        .success,
    ).toBe(false);
    expect(
      regrasAgendamentoSchema.safeParse({
        ...REGRAS_AGENDAMENTO_PADRAO,
        lembretesHoras: [24, 2, 1],
      }).success,
    ).toBe(false);
  });
});

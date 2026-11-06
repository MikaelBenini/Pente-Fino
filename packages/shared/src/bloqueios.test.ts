import { describe, expect, it } from 'vitest';
import {
  bloqueioRecorrenteSchema,
  recorrentesNoDia,
  recorteDoDia,
  textoAvisosEncaixe,
} from './bloqueios.js';

describe('bloqueios', () => {
  const almoco = {
    diaSemana: 2,
    inicioMin: 12 * 60,
    fimMin: 13 * 60,
    desde: '2026-12-01',
    ate: null,
  };
  it('almoço de toda terça: cai nas terças a partir do começo, até o fim se tiver', () => {
    expect(recorrentesNoDia([almoco], '2026-12-08')).toEqual([
      { inicio: new Date('2026-12-08T15:00:00Z'), fim: new Date('2026-12-08T16:00:00Z') },
    ]);
    expect(recorrentesNoDia([almoco], '2026-12-09')).toEqual([]); // quarta
    expect(recorrentesNoDia([almoco], '2026-11-24')).toEqual([]); // antes do começo
    expect(recorrentesNoDia([{ ...almoco, ate: '2026-12-10' }], '2026-12-15')).toEqual([]);
  });

  it('férias de vários dias aparecem recortadas em cada dia', () => {
    const ferias = {
      inicio: new Date('2026-12-07T03:00:00Z'),
      fim: new Date('2026-12-12T03:00:00Z'),
    };
    expect(recorteDoDia(ferias, '2026-12-09')).toEqual({
      inicio: new Date('2026-12-09T03:00:00Z'),
      fim: new Date('2026-12-10T03:00:00Z'),
    });
    expect(recorteDoDia(ferias, '2026-12-12')).toBeNull();
  });

  it('entrada: fim depois do início; aviso do encaixe por extenso', () => {
    expect(bloqueioRecorrenteSchema.safeParse({ ...almoco, motivo: 'Almoço' }).success).toBe(true);
    expect(
      bloqueioRecorrenteSchema.safeParse({ ...almoco, fimMin: 600, motivo: null }).success,
    ).toBe(false);
    expect(textoAvisosEncaixe(['fora_do_expediente', 'bloqueio'])).toBe(
      'Esse horário fica fora do expediente do profissional e em cima de um bloqueio da agenda. Encaixar mesmo assim?',
    );
  });
});

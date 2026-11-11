import { describe, expect, it } from 'vitest';
import { dataDoBanco, dataLocal, dataParaBanco, periodoAnterior, ultimoDiaDe } from './datas.js';

describe('dataLocal', () => {
  it('usa o dia de São Paulo, não o de UTC', () => {
    // 02h UTC do dia 4 ainda é 23h do dia 3 em São Paulo (UTC−3).
    expect(dataLocal(new Date('2026-11-04T02:00:00Z'))).toBe('2026-11-03');
    expect(dataLocal(new Date('2026-11-04T03:00:00Z'))).toBe('2026-11-04');
  });
});

describe('dataParaBanco e dataDoBanco', () => {
  it('vão e voltam sem mudar o dia', () => {
    expect(dataDoBanco(dataParaBanco('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('periodoAnterior', () => {
  it('mês fechado: o mês anterior inteiro (inclusive virada de ano e fevereiro)', () => {
    expect(periodoAnterior('2026-10-01', '2026-10-31', '2026-11-11')).toEqual({
      de: '2026-09-01',
      ate: '2026-09-30',
    });
    expect(periodoAnterior('2026-01-01', '2026-01-31', '2026-11-11')).toEqual({
      de: '2025-12-01',
      ate: '2025-12-31',
    });
    expect(periodoAnterior('2026-03-01', '2026-03-31', '2026-11-11')).toEqual({
      de: '2026-02-01',
      ate: '2026-02-28',
    });
  });

  it('mês corrente: os mesmos dias do mês anterior, sem passar do fim dele', () => {
    expect(periodoAnterior('2026-11-01', '2026-11-30', '2026-11-11')).toEqual({
      de: '2026-10-01',
      ate: '2026-10-11',
    });
    expect(periodoAnterior('2026-03-01', '2026-03-31', '2026-03-30')).toEqual({
      de: '2026-02-01',
      ate: '2026-02-28',
    });
  });

  it('outro período: os mesmos N dias logo antes', () => {
    expect(periodoAnterior('2026-11-05', '2026-11-11', '2026-11-11')).toEqual({
      de: '2026-10-29',
      ate: '2026-11-04',
    });
  });

  it('último dia do mês', () => {
    expect(ultimoDiaDe('2028-02')).toBe('2028-02-29');
    expect(ultimoDiaDe('2026-12')).toBe('2026-12-31');
  });
});

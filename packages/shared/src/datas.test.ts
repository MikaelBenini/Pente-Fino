import { describe, expect, it } from 'vitest';
import { dataDoBanco, dataLocal, dataParaBanco } from './datas.js';

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

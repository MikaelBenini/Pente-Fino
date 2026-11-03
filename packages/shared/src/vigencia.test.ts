import { describe, expect, it } from 'vitest';
import { selecionarVigente } from './vigencia.js';

const precos = [
  { vigenciaInicio: '2026-01-01', valor: 4000 },
  { vigenciaInicio: '2026-10-15', valor: 4500 },
  { vigenciaInicio: '2026-06-01', valor: 4200 },
];

describe('selecionarVigente', () => {
  it('pega a maior vigência até a data, mesmo fora de ordem', () => {
    expect(selecionarVigente(precos, '2026-09-30')?.valor).toBe(4200);
  });

  it('a vigência começa no próprio dia', () => {
    expect(selecionarVigente(precos, '2026-10-15')?.valor).toBe(4500);
    expect(selecionarVigente(precos, '2026-10-14')?.valor).toBe(4200);
  });

  it('antes da primeira vigência não há preço', () => {
    expect(selecionarVigente(precos, '2025-12-31')).toBeUndefined();
  });

  it('recusa data fora do formato', () => {
    expect(() => selecionarVigente(precos, '15/10/2026')).toThrow(RangeError);
  });
});

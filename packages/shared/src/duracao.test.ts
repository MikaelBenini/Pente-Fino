import { describe, expect, it } from 'vitest';
import { duracaoEmMs } from './duracao.js';

describe('duracaoEmMs', () => {
  it('converte as unidades', () => {
    expect(duracaoEmMs('45s')).toBe(45_000);
    expect(duracaoEmMs('15m')).toBe(900_000);
    expect(duracaoEmMs('12h')).toBe(43_200_000);
    expect(duracaoEmMs('30d')).toBe(2_592_000_000);
  });

  it('recusa formato desconhecido', () => {
    expect(() => duracaoEmMs('15 minutos')).toThrow(RangeError);
  });
});

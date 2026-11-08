import { describe, expect, it } from 'vitest';
import { emailDescartavel, pareceRobo, TEMPO_MINIMO_CADASTRO_MS } from './protecao-cadastro.js';

describe('proteção do cadastro', () => {
  const agora = 1_800_000_000_000;
  it('pessoa: campo isca vazio e alguns segundos para preencher', () => {
    expect(pareceRobo({ site: '', abertoEm: agora - 15_000 }, agora)).toBe(false);
  });
  it('robô: campo isca preenchido, sem carimbo, rápido ou velho demais', () => {
    expect(pareceRobo({ site: 'http://spam', abertoEm: agora - 15_000 }, agora)).toBe(true);
    expect(pareceRobo({}, agora)).toBe(true);
    expect(pareceRobo({ abertoEm: agora - TEMPO_MINIMO_CADASTRO_MS + 100 }, agora)).toBe(true);
    expect(pareceRobo({ abertoEm: agora - 2 * 86_400_000 }, agora)).toBe(true);
  });
  it('e-mail descartável', () => {
    expect(emailDescartavel('x@Mailinator.com')).toBe(true);
    expect(emailDescartavel('dono@gmail.com')).toBe(false);
    expect(emailDescartavel('sem-arroba')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { verificarLimite } from './planos.js';

describe('limites do plano', () => {
  it('básico: 1 unidade e 3 profissionais', () => {
    expect(verificarLimite('basico', 'unidades', 0)).toBeNull();
    expect(verificarLimite('basico', 'unidades', 1)).toMatch(/permite 1 unidade/);
    expect(verificarLimite('basico', 'profissionais', 2)).toBeNull();
    expect(verificarLimite('basico', 'profissionais', 3)).toMatch(/3 profissionais ativos/);
  });

  it('pro: até 10 profissionais', () => {
    expect(verificarLimite('pro', 'profissionais', 9)).toBeNull();
    expect(verificarLimite('pro', 'profissionais', 10)).not.toBeNull();
  });

  it('premium: sem limite', () => {
    expect(verificarLimite('premium', 'unidades', 40)).toBeNull();
    expect(verificarLimite('premium', 'profissionais', 500)).toBeNull();
  });
});

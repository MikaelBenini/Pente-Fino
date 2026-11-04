import { describe, expect, it } from 'vitest';
import {
  diasRestantesTeste,
  incluiRecurso,
  precoPorMes,
  RECURSOS_PLANO,
  resumoAnual,
  verificarLimite,
} from './planos.js';

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

describe('preços de venda (seção 7 da documentação)', () => {
  it('mensal e anual por mês', () => {
    expect(precoPorMes('basico', 'mensal')).toBe(7990);
    expect(precoPorMes('pro', 'anual')).toBe(12490);
  });

  it('anual total e economia batem com a tabela', () => {
    expect(resumoAnual('basico')).toEqual({ total: 80280, economia: 15600 });
    expect(resumoAnual('pro')).toEqual({ total: 149880, economia: 30000 });
    expect(resumoAnual('premium')).toEqual({ total: 249480, economia: 50400 });
  });

  it('rede de 4 unidades no Premium: R$ 549,60 no mensal e R$ 456,60 no anual', () => {
    expect(precoPorMes('premium', 'mensal', 4)).toBe(54960);
    expect(precoPorMes('premium', 'anual', 4)).toBe(45660);
  });

  it('unidade extra só conta no Premium', () => {
    expect(precoPorMes('pro', 'mensal', 3)).toBe(14990);
  });

  it('cada plano inclui o que o anterior tem', () => {
    const basico = RECURSOS_PLANO.filter((r) => incluiRecurso('basico', r));
    const pro = RECURSOS_PLANO.filter((r) => incluiRecurso('pro', r));
    expect(pro.length).toBeGreaterThan(basico.length);
    expect(basico.every((r) => incluiRecurso('premium', r))).toBe(true);
  });
});

describe('diasRestantesTeste', () => {
  it('conta dias pelo calendário de São Paulo', () => {
    const agora = new Date('2026-11-04T15:00:00Z'); // 12h em SP
    expect(diasRestantesTeste(new Date('2026-11-18T15:00:00Z'), agora)).toBe(14);
    // 01h UTC do dia 19 ainda é dia 18 em SP.
    expect(diasRestantesTeste(new Date('2026-11-19T01:00:00Z'), agora)).toBe(14);
    expect(diasRestantesTeste(new Date('2026-11-04T23:00:00Z'), agora)).toBe(0);
    expect(diasRestantesTeste(new Date('2026-11-02T12:00:00Z'), agora)).toBe(-2);
  });
});

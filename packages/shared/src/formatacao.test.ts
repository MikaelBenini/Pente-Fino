import { describe, expect, it } from 'vitest';
import {
  formatarData,
  formatarDataHora,
  formatarDiaPorExtenso,
  formatarFracao,
  formatarHora,
  formatarMoeda,
  formatarPercentualBp,
  formatarTelefone,
  formatarValor,
} from './formatacao.js';

describe('formatação pt-BR', () => {
  it('moeda a partir de centavos', () => {
    expect(formatarMoeda(123456)).toBe('R$ 1.234,56');
    expect(formatarMoeda(5)).toBe('R$ 0,05');
    expect(formatarMoeda(-2000)).toBe('-R$ 20,00');
    expect(formatarValor(450000)).toBe('4.500,00');
  });

  it('percentuais', () => {
    expect(formatarPercentualBp(4000)).toBe('40%');
    expect(formatarPercentualBp(4250)).toBe('42,5%');
    expect(formatarFracao(0.4256)).toBe('42,6%');
  });

  it('data e hora no fuso de São Paulo', () => {
    const instante = '2026-11-04T01:30:00Z'; // 22h30 do dia 3 em São Paulo
    expect(formatarData(instante)).toBe('03/11/2026');
    expect(formatarHora(instante)).toBe('22:30');
    expect(formatarDataHora(instante)).toBe('03/11/2026 22:30');
    expect(formatarDiaPorExtenso(instante)).toBe('terça, 3 de novembro');
  });

  it('telefone', () => {
    expect(formatarTelefone('5511988887777')).toBe('(11) 98888-7777');
    expect(formatarTelefone('551133334444')).toBe('(11) 3333-4444');
    expect(formatarTelefone('11988887777')).toBe('(11) 98888-7777');
    expect(formatarTelefone('123')).toBe('123');
  });
});

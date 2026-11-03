import { describe, expect, it } from 'vitest';
import { comissaoItem, lucroServico, valorItem } from './dinheiro.js';

describe('valorItem', () => {
  it('multiplica quantidade por preço e tira o desconto', () => {
    expect(valorItem({ quantidade: 2, precoUnitario: 4500, desconto: 500 })).toBe(8500);
  });

  it('sem desconto usa zero', () => {
    expect(valorItem({ quantidade: 1, precoUnitario: 3990 })).toBe(3990);
  });

  it('recusa valor que não é inteiro em centavos', () => {
    expect(() => valorItem({ quantidade: 1, precoUnitario: 39.9 })).toThrow(RangeError);
  });

  it('recusa desconto maior que o item', () => {
    expect(() => valorItem({ quantidade: 1, precoUnitario: 1000, desconto: 1001 })).toThrow(
      RangeError,
    );
  });
});

describe('comissaoItem', () => {
  it('aplica o percentual em pontos-base', () => {
    expect(comissaoItem(5000, 1, { percentualBp: 4000 })).toBe(2000);
  });

  it('arredonda meio centavo para cima', () => {
    // 3333 × 45% = 1499,85 → 1500
    expect(comissaoItem(3333, 1, { percentualBp: 4500 })).toBe(1500);
    // 1001 × 50% = 500,5 → 501
    expect(comissaoItem(1001, 1, { percentualBp: 5000 })).toBe(501);
  });

  it('valor fixo multiplica pela quantidade', () => {
    expect(comissaoItem(9000, 2, { valorFixo: 1500 })).toBe(3000);
  });

  it('item coberto pelo clube (valor zero) com percentual dá zero', () => {
    expect(comissaoItem(0, 1, { percentualBp: 4000 })).toBe(0);
  });

  it('recusa percentual acima de 100%', () => {
    expect(() => comissaoItem(1000, 1, { percentualBp: 10_001 })).toThrow(RangeError);
  });
});

describe('lucroServico', () => {
  it('receita menos custo de produto e comissão', () => {
    expect(lucroServico(5000, 300, 2000)).toBe(2700);
  });

  it('pode ser negativo', () => {
    expect(lucroServico(1000, 500, 800)).toBe(-300);
  });
});

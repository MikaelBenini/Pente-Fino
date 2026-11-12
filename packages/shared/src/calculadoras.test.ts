import { describe, expect, it } from 'vitest';
import { comissaoDoBarbeiro, precoMinimoDoCorte, sobraDoCorte } from './calculadoras.js';

describe('sobraDoCorte (calculadora da home e /calculadora/lucro-por-corte)', () => {
  it('R$ 60 com 45% e R$ 3,50 de produto sobra R$ 29,50', () => {
    expect(sobraDoCorte({ preco: 6000, comissaoPct: 45, produto: 350 })).toEqual({
      comissao: 2700,
      produto: 350,
      sobra: 2950,
    });
  });

  it('comissão acima de 100% vale 100%, e o produto não deixa a sobra negativa', () => {
    expect(sobraDoCorte({ preco: 5000, comissaoPct: 150, produto: 100 })).toEqual({
      comissao: 5000,
      produto: 0,
      sobra: 0,
    });
    expect(sobraDoCorte({ preco: 5000, comissaoPct: 50, produto: 9000 }).sobra).toBe(0);
  });
});

describe('comissaoDoBarbeiro (/calculadora/comissao-de-barbeiro)', () => {
  it('sobre o preço cheio: R$ 50 com 40% dá R$ 20 ao barbeiro', () => {
    expect(
      comissaoDoBarbeiro({ preco: 5000, comissaoPct: 40, produto: 500, descontarProduto: false }),
    ).toEqual({ base: 5000, barbeiro: 2000, produto: 500, casa: 2500 });
  });

  it('descontando o produto antes: a comissão sai de R$ 45', () => {
    expect(
      comissaoDoBarbeiro({ preco: 5000, comissaoPct: 40, produto: 500, descontarProduto: true }),
    ).toEqual({ base: 4500, barbeiro: 1800, produto: 500, casa: 2700 });
  });

  it('produto maior que o preço não gera comissão negativa', () => {
    const r = comissaoDoBarbeiro({
      preco: 3000,
      comissaoPct: 50,
      produto: 4000,
      descontarProduto: true,
    });
    expect(r.base).toBe(0);
    expect(r.barbeiro).toBe(0);
  });
});

describe('precoMinimoDoCorte (/calculadora/preco-do-corte)', () => {
  it('R$ 6.000 de fixo, 400 cortes, 45% de comissão, R$ 3,50 de produto e 20% de margem', () => {
    // (350 + 1500) / (1 - 0,45 - 0,20) = 1850 / 0,35 = 5285,7 → R$ 52,86
    const r = precoMinimoDoCorte({
      custosFixosMes: 600000,
      cortesMes: 400,
      comissaoPct: 45,
      produto: 350,
      margemPct: 20,
    });
    expect(r).toEqual({ preco: 5286, fixoPorCorte: 1500, comissao: 2379, margem: 1057 });
  });

  it('sem margem, o preço só paga os custos', () => {
    const r = precoMinimoDoCorte({
      custosFixosMes: 400000,
      cortesMes: 400,
      comissaoPct: 50,
      produto: 0,
      margemPct: 0,
    });
    expect(r?.preco).toBe(2000);
  });

  it('comissão mais margem chegando a 100% não tem preço possível', () => {
    expect(
      precoMinimoDoCorte({
        custosFixosMes: 1000,
        cortesMes: 10,
        comissaoPct: 60,
        produto: 0,
        margemPct: 40,
      }),
    ).toBeNull();
  });

  it('zero cortes no mês não divide por zero', () => {
    expect(
      precoMinimoDoCorte({
        custosFixosMes: 1000,
        cortesMes: 0,
        comissaoPct: 40,
        produto: 0,
        margemPct: 10,
      }),
    ).toBeNull();
  });
});

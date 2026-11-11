import { describe, expect, it } from 'vitest';
import { linhaDoCatalogo, regraVigente } from './catalogo-servicos.js';

describe('catálogo de serviços com preço e sobra (painel M3)', () => {
  it('Corte R$ 45, barbeiro com 40% e custo R$ 1,50: comissão R$ 18 e sobra R$ 25,50', () => {
    expect(
      linhaDoCatalogo({
        precos: [{ unidadeId: 'u1', valor: 4500 }],
        custoProduto: 150,
        barbeiros: [{ unidadeId: 'u1', regra: { percentualBp: 4000 } }],
      }),
    ).toEqual({ preco: { min: 4500, max: 4500 }, comissaoMedia: 1800, sobraMedia: 2550 });
  });

  it('dois barbeiros e duas unidades: faixa de preço e médias', () => {
    const l = linhaDoCatalogo({
      precos: [
        { unidadeId: 'u1', valor: 4500 },
        { unidadeId: 'u2', valor: 6000 },
      ],
      custoProduto: 0,
      barbeiros: [
        { unidadeId: 'u1', regra: { percentualBp: 4000 } }, // 1800
        { unidadeId: 'u1', regra: { valorFixo: 2000 } }, // 2000
        { unidadeId: 'u2', regra: { percentualBp: 5000 } }, // 3000
      ],
    });
    expect(l.preco).toEqual({ min: 4500, max: 6000 });
    expect(l.comissaoMedia).toBe(Math.round((1800 + 2000 + 3000) / 3));
    expect(l.sobraMedia).toBe(Math.round((2700 + 2500 + 3000) / 3));
  });

  it('sem preço: nada a calcular; unidade sem barbeiro com regra: comissão zero', () => {
    expect(linhaDoCatalogo({ precos: [], custoProduto: 100, barbeiros: [] })).toEqual({
      preco: null,
      comissaoMedia: null,
      sobraMedia: null,
    });
    expect(
      linhaDoCatalogo({
        precos: [{ unidadeId: 'u1', valor: 3000 }],
        custoProduto: 200,
        barbeiros: [{ unidadeId: 'u1', regra: null }],
      }),
    ).toMatchObject({ comissaoMedia: 0, sobraMedia: 2800 });
  });

  it('sobra negativa aparece (custo maior que o preço)', () => {
    expect(
      linhaDoCatalogo({
        precos: [{ unidadeId: 'u1', valor: 1000 }],
        custoProduto: 1500,
        barbeiros: [],
      }).sobraMedia,
    ).toBe(-500);
  });

  it('regra vigente: a mais recente que já começou, só de serviço', () => {
    const regras = [
      {
        tipoItem: 'servico' as const,
        percentualBp: 4000,
        valorFixo: null,
        vigenciaInicio: '2026-01-01',
      },
      {
        tipoItem: 'servico' as const,
        percentualBp: 4500,
        valorFixo: null,
        vigenciaInicio: '2026-11-01',
      },
      {
        tipoItem: 'servico' as const,
        percentualBp: 5000,
        valorFixo: null,
        vigenciaInicio: '2026-12-01',
      },
      {
        tipoItem: 'produto' as const,
        percentualBp: 1000,
        valorFixo: null,
        vigenciaInicio: '2026-11-10',
      },
    ];
    expect(regraVigente(regras, '2026-11-11')).toEqual({ percentualBp: 4500 });
    expect(regraVigente(regras, '2025-12-31')).toBeNull();
    expect(
      regraVigente(
        [
          {
            tipoItem: 'servico',
            percentualBp: null,
            valorFixo: 2000,
            vigenciaInicio: '2026-01-01',
          },
        ],
        '2026-11-11',
      ),
    ).toEqual({ valorFixo: 2000 });
  });
});

import { describe, expect, it } from 'vitest';
import {
  cicloDaAdesao,
  coberturaDoServico,
  comissaoDoClube,
  restantesDoCiclo,
  situacaoDaAdesao,
  somarMeses,
} from './clube.js';

describe('ciclo da adesão', () => {
  it('soma meses sem pular mês curto; o ciclo vai do dia seguinte ao vencimento anterior', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(somarMeses('2026-03-15', -1)).toBe('2026-02-15');
    expect(cicloDaAdesao('2026-12-10')).toEqual({ de: '2026-11-11', ate: '2026-12-10' });
  });

  it('ativa até o dia do vencimento; cancelada continua cancelada', () => {
    expect(situacaoDaAdesao('ativa', '2026-12-10', '2026-12-10')).toBe('ativa');
    expect(situacaoDaAdesao('ativa', '2026-12-10', '2026-12-11')).toBe('vencida');
    expect(situacaoDaAdesao('cancelada', '2026-12-10', '2026-12-01')).toBe('cancelada');
  });
});

describe('o que o plano cobre (RN-07)', () => {
  const plano = {
    limiteUsoMes: 5,
    servicos: [
      { servicoId: 'corte', quantidade: 4 },
      { servicoId: 'barba', quantidade: null },
    ],
  };
  const nenhum = { total: 0, porServico: {} };

  it('coberto até o limite do serviço; o resto vira extra; fora do plano, tudo extra', () => {
    expect(coberturaDoServico(plano, nenhum, 'corte')).toEqual({ cobertas: 1, extras: 0 });
    expect(coberturaDoServico(plano, { total: 4, porServico: { corte: 4 } }, 'corte')).toEqual({
      cobertas: 0,
      extras: 1,
    });
    expect(coberturaDoServico(plano, { total: 3, porServico: { corte: 3 } }, 'corte', 2)).toEqual({
      cobertas: 1,
      extras: 1,
    });
    expect(coberturaDoServico(plano, nenhum, 'sobrancelha')).toEqual({ cobertas: 0, extras: 1 });
  });

  it('serviço sem limite próprio para no limite do plano', () => {
    expect(coberturaDoServico(plano, { total: 5, porServico: { barba: 5 } }, 'barba')).toEqual({
      cobertas: 0,
      extras: 1,
    });
    expect(restantesDoCiclo(plano, { total: 3, porServico: { corte: 3 } })).toEqual([
      { servicoId: 'corte', restam: 1 },
      { servicoId: 'barba', restam: 2 },
    ]);
    expect(
      restantesDoCiclo(
        { limiteUsoMes: null, servicos: [{ servicoId: 'x', quantidade: null }] },
        nenhum,
      ),
    ).toEqual([{ servicoId: 'x', restam: null }]);
  });
});

describe('comissão do clube', () => {
  it('% do profissional sobre o preço de tabela; o valor fixo do dono vence', () => {
    expect(
      comissaoDoClube({
        precoTabela: 5000,
        quantidade: 1,
        regraProfissional: { percentualBp: 4000 },
        valorFixoClube: null,
      }),
    ).toBe(2000);
    expect(
      comissaoDoClube({
        precoTabela: 5000,
        quantidade: 2,
        regraProfissional: { percentualBp: 4000 },
        valorFixoClube: 1500,
      }),
    ).toBe(3000);
    expect(
      comissaoDoClube({
        precoTabela: 5000,
        quantidade: 1,
        regraProfissional: null,
        valorFixoClube: null,
      }),
    ).toBe(0);
  });
});

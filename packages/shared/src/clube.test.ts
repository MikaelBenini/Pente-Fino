import { describe, expect, it } from 'vitest';
import {
  cicloDaAdesao,
  coberturaDoServico,
  comissaoDoClube,
  restantesDoCiclo,
  resumirClube,
  situacaoDaAdesao,
  somarMeses,
  textoClubeNoBot,
  vencimentoDepoisDaBaixa,
} from './clube.js';

describe('ciclo da adesão', () => {
  it('soma meses sem pular mês curto; o ciclo vai do dia seguinte ao vencimento anterior', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(somarMeses('2026-03-15', -1)).toBe('2026-02-15');
    expect(cicloDaAdesao('2026-12-10')).toEqual({ de: '2026-11-10', ate: '2026-12-09' });
  });

  it('em dia até a véspera do vencimento; cancelada continua cancelada', () => {
    expect(situacaoDaAdesao('ativa', '2026-12-10', '2026-12-09')).toBe('ativa');
    expect(situacaoDaAdesao('ativa', '2026-12-10', '2026-12-10')).toBe('vencida');
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

describe('baixa da mensalidade', () => {
  it('um mês adiante mantendo o dia; vencida há mais de um ciclo recomeça de hoje', () => {
    expect(vencimentoDepoisDaBaixa('2026-12-10', '2026-12-08')).toBe('2027-01-10');
    expect(vencimentoDepoisDaBaixa('2026-12-10', '2026-12-20')).toBe('2027-01-10');
    expect(vencimentoDepoisDaBaixa('2026-10-10', '2026-12-20')).toBe('2027-01-20');
  });
});

describe('clube no bot', () => {
  const moeda = (v: number) => `R$ ${(v / 100).toFixed(2).replace('.', ',')}`;
  it('assinante vê o plano, a renovação e o que resta; quem não é vê os planos', () => {
    expect(
      textoClubeNoBot(
        {
          planos: [],
          assinatura: {
            plano: 'Clube Corte',
            vencimento: '2026-12-10',
            emDia: true,
            restantes: [
              { servico: 'Corte', restam: 2 },
              { servico: 'Barba', restam: null },
            ],
          },
        },
        moeda,
      ),
    ).toBe(
      'Seu plano: Clube Corte\nRenova em 10/12.\n\nNeste mês ainda tem:\n• Corte: 2\n• Barba: à vontade',
    );
    expect(
      textoClubeNoBot(
        { planos: [{ nome: 'Clube', valor: 9990, inclusos: '4 cortes' }], assinatura: null },
        moeda,
      ),
    ).toContain('• Clube: R$ 99,90 por mês (4 cortes)');
    expect(textoClubeNoBot({ planos: [], assinatura: null }, moeda)).toContain(
      'Ainda não temos clube',
    );
  });
});

describe('relatório do clube', () => {
  it('mensalidades menos comissões e custo de produto, por plano e no total', () => {
    const r = resumirClube({
      planos: [
        { id: 'a', nome: 'Clube Corte', ativos: 2 },
        { id: 'b', nome: 'Clube Barba', ativos: 1 },
      ],
      mensalidades: [
        { planoId: 'a', valor: 9990 },
        { planoId: 'a', valor: 9990 },
        { planoId: 'b', valor: 4990 },
      ],
      atendimentos: [
        { planoId: 'a', quantidade: 3, comissao: 6000, custo: 450 },
        { planoId: 'b', quantidade: 4, comissao: 4800, custo: 800 },
      ],
    });
    expect(r.porPlano).toEqual([
      expect.objectContaining({
        plano: 'Clube Corte',
        mensalidades: 19980,
        comissoes: 6000,
        custoProdutos: 450,
        lucro: 13530,
        atendimentos: 3,
      }),
      expect.objectContaining({ plano: 'Clube Barba', mensalidades: 4990, lucro: -610 }),
    ]);
    expect(r).toMatchObject({
      mensalidades: 24970,
      comissoes: 10800,
      custoProdutos: 1250,
      lucro: 12920,
      atendimentos: 7,
    });
  });
});

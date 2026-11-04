// Casos tirados dos prints da planilha (briefing VHG Studio, 03/11/2026). Valores fictícios,
// mas as contas e as fórmulas são as da planilha real. Cada bloco diz o que a planilha faz
// e o que o sistema faz no lugar.
import { describe, expect, it } from 'vitest';
import { comissaoItem, valorItem } from './dinheiro.js';
import { formatarFracao, formatarMoeda } from './formatacao.js';
import {
  calcularIndicadores,
  diasDeTrabalho,
  lucratividadePorServico,
  projetar,
  type ComandaFechada,
  type ItemFechado,
} from './indicadores.js';

/** Item de serviço com a comissão calculada pela regra (percentual em pontos-base). */
function item(
  servicoId: string,
  quantidade: number,
  preco: number,
  o: { extra?: boolean; peso?: number; custo?: number; comissaoBp?: number } = {},
): ItemFechado {
  const base = { quantidade, precoUnitario: preco, desconto: 0 };
  return {
    tipo: 'servico',
    servicoId,
    ...base,
    ehExtra: o.extra ?? false,
    pesoAtendimento: o.peso ?? (o.extra ? 0 : 1),
    custoUnitario: o.custo ?? 0,
    comissaoValor: o.comissaoBp
      ? comissaoItem(valorItem(base), quantidade, { percentualBp: o.comissaoBp })
      : 0,
  };
}
/** Uma comanda por atendimento: n comandas com o mesmo item. */
function comandas(
  n: number,
  i: Omit<ItemFechado, 'quantidade'> & { quantidade?: number },
): ComandaFechada[] {
  return Array.from({ length: n }, () => ({ itens: [{ ...i, quantidade: 1 }] }));
}

describe('Print 1 e 3 · faturamento e quantidade por serviço (linha 39 e 40)', () => {
  // Tabela de preços (A2:B20) e quantidades do mês (linha 40).
  const casos = [
    ['promo', 32, 3000, 960],
    ['carteirinha', 48, 2500, 1200],
    ['barba express', 28, 2000, 560],
    ['corte barb. A', 54, 4500, 2430],
    ['barba barb. A', 29, 4000, 1160],
    ['con barb. A', 49, 7000, 3430],
    ['con cab/bar A', 11, 12000, 1320],
  ] as const;

  it.each(casos)('%s: %i × preço = R$ %i', (id, qtde, preco, reais) => {
    const r = lucratividadePorServico(comandas(qtde, item(id, 1, preco)));
    expect(r[0]).toMatchObject({ servicoId: id, quantidade: qtde, receita: reais * 100 });
  });
});

describe('Print 3 · ticket médio e o "cliente" (W40 e X39)', () => {
  // Março: faturamento R$ 27.481 e 408 clientes → ticket R$ 67,36.
  const fechadas: ComandaFechada[] = [
    ...comandas(220, item('corte', 1, 6736)),
    ...comandas(188, item('corte', 1, 6735)),
  ];

  it('ticket = faturamento ÷ clientes = R$ 67,36', () => {
    const r = calcularIndicadores(fechadas);
    expect(r.faturamento).toBe(2_748_100);
    expect(r.clientes).toBe(408);
    expect(formatarMoeda(r.ticketMedio)).toBe('R$ 67,36');
  });

  it('PROBLEMA: em janeiro a carteirinha contava como cliente e em março não. Sistema: comanda fechada com serviço é cliente, todo mês', () => {
    const r = calcularIndicadores([...fechadas, ...comandas(48, item('carteirinha', 1, 2500))]);
    expect(r.clientes).toBe(408 + 48);
  });

  it('comanda só de produto não é cliente', () => {
    const r = calcularIndicadores([
      { itens: [{ ...item('x', 1, 4500), tipo: 'produto', servicoId: null, pesoAtendimento: 0 }] },
    ]);
    expect(r).toMatchObject({ clientes: 0, faturamento: 4500 });
  });
});

describe('Print 2 · total do dia × faturamento do mês: o "outros" (Z4 e W39)', () => {
  it('PROBLEMA: Z35 soma "outros" e W39 não. Sistema: "outros" é receita não operacional, separada e sempre fora do faturamento', () => {
    const dia: ComandaFechada[] = [
      {
        itens: [
          item('corte', 2, 4500),
          { ...item('outros', 1, 3000), tipo: 'nao_operacional', servicoId: null },
        ],
      },
    ];
    const r = calcularIndicadores(dia);
    expect(r.faturamento).toBe(9000);
    expect(r.receitaNaoOperacional).toBe(3000);
  });

  it('desconto (coluna Y) sai do faturamento', () => {
    const r = calcularIndicadores([{ itens: [{ ...item('corte', 1, 4500), desconto: 500 }] }]);
    expect(r.faturamento).toBe(4000);
  });
});

describe('Atendimentos (Y39)', () => {
  it('PROBLEMA: a planilha multiplica convênio por 2 à mão e janeiro inclui o barbeiro A. Sistema: soma do peso cadastrado no serviço', () => {
    const r = calcularIndicadores([
      ...comandas(32, item('promo', 1, 3000)),
      ...comandas(11, item('convenio corte e barba', 1, 12000, { peso: 2 })),
      ...comandas(10, item('sobrancelha', 1, 1500, { extra: true })),
    ]);
    expect(r.atendimentos).toBe(32 + 11 * 2);
  });
});

describe('Print 6 · pequenos serviços (AA39 e AB39)', () => {
  it('% de extras = quantidade de extras ÷ clientes: 175 ÷ 408 = 42,9%', () => {
    const r = calcularIndicadores([
      ...comandas(175, { ...item('corte', 1, 4500) }).map((c) => ({
        itens: [...c.itens, item('sobrancelha', 1, 1500, { extra: true })],
      })),
      ...comandas(233, item('corte', 1, 4500)),
    ]);
    expect(r.extrasQuantidade).toBe(175);
    expect(formatarFracao(r.percentualExtras)).toBe('42,9%');
  });

  it('PROBLEMA: química entrava em reais nos extras, mas não em quantidade. Sistema: todo extra conta nos dois', () => {
    const r = calcularIndicadores([
      { itens: [item('corte', 1, 4500), item('quimica', 1, 5000, { extra: true })] },
    ]);
    expect(r).toMatchObject({ extrasQuantidade: 1, extrasValor: 5000 });
  });
});

describe('Print 4 · despesas e % sobre o faturamento (Y52)', () => {
  const faturamento = comandas(1, item('mes', 1, 2_748_100));
  const despesas = [
    { grupo: 'fixa' as const, valor: 620_000 },
    { grupo: 'manutencao' as const, valor: 110_000 },
    { grupo: 'variavel' as const, valor: 180_000 },
    { grupo: 'investimento' as const, valor: 70_000 },
    { grupo: 'cartao_resgate' as const, valor: 230_000 },
  ];
  const r = calcularIndicadores(faturamento, despesas);
  const pct = (v: number) => formatarFracao(v / r.faturamento);

  it('cada grupo sobre o faturamento bate com a linha 45', () => {
    expect(pct(r.despesasPorGrupo.fixa)).toBe('22,6%');
    expect(pct(r.despesasPorGrupo.investimento)).toBe('2,5%');
    expect(pct(r.despesasPorGrupo.manutencao)).toBe('4%');
    expect(pct(r.despesasPorGrupo.variavel)).toBe('6,5%');
  });

  it('a planilha dá 35,7% porque soma investimento; o sistema deixa investimento e cartão de fora: 33,1%', () => {
    const daPlanilha = (620_000 + 0 + 70_000 + 110_000 + 180_000) / r.faturamento;
    expect(formatarFracao(daPlanilha)).toBe('35,7%');
    expect(formatarFracao(r.percentualDespesas)).toBe('33,1%');
  });

  it('PROBLEMA: o bloco de comissões estava vazio e o % saía menor. Sistema: a comissão de cada item entra sozinha', () => {
    const comComissao = calcularIndicadores(
      comandas(1, item('mes', 1, 2_748_100, { comissaoBp: 4500 })),
      despesas,
    );
    expect(comComissao.comissoes).toBe(1_236_645);
    expect(formatarFracao(comComissao.percentualDespesas)).toBe('78,1%');
  });
});

describe('Print 5 · projeção do mês (AB61)', () => {
  // Março de 2026: 31 dias, 5 domingos → 26 dias de trabalho (segunda a sábado).
  const dias = diasDeTrabalho('2026-03', [1, 2, 3, 4, 5, 6], []);

  it('PROBLEMA: os dias eram digitados à mão (X59 = 25, AA61 = 26). Sistema: calendário da unidade', () => {
    expect(dias).toHaveLength(26);
    expect(dias).toContain('2026-03-31');
  });

  it('R$ 27.481 em 25 dias trabalhados → R$ 1.099 por dia → projeção de R$ 28.580', () => {
    const p = projetar(2_748_100, dias, '2026-03-30');
    expect(p.diasTrabalhados).toBe(25);
    expect(formatarMoeda(Math.round(2_748_100 / 25))).toBe('R$ 1.099,24');
    expect(formatarMoeda(p.projecao)).toBe('R$ 28.580,24');
  });

  it('PROBLEMA: a hidratação ignorava o dia 31 (SUM(V4:V33)). Sistema: o dia 31 é dia como qualquer outro', () => {
    expect(projetar(2_748_100, dias, '2026-03-31').diasTrabalhados).toBe(26);
  });

  it('feriado no calendário tira o dia da projeção', () => {
    const comFeriado = diasDeTrabalho(
      '2026-03',
      [1, 2, 3, 4, 5, 6],
      [{ data: '2026-03-02', trabalha: false }],
    );
    expect(comFeriado).toHaveLength(25);
  });
});

describe('Dashboard de exemplo · lucratividade por serviço (custo = produto + comissão de 45%)', () => {
  const linha = (id: string, qtde: number, preco: number, produto: number) => ({
    itens: [{ ...item(id, qtde, preco, { custo: produto, comissaoBp: 4500 }) }],
  });
  const r = lucratividadePorServico([
    linha('Corte', 540, 4500, 1100),
    linha('Barba', 261, 4000, 600),
    linha('Sobrancelha', 199, 1500, 100),
    linha('Hidratação', 57, 2500, 600),
    linha('Depilação', 85, 2000, 200),
  ]);
  const por = Object.fromEntries(r.map((s) => [s.servicoId, s]));

  it.each([
    ['Corte', 'R$ 24.300,00', 'R$ 31,25', 'R$ 7.425,00', '30,6%'],
    ['Barba', 'R$ 10.440,00', 'R$ 24,00', 'R$ 4.176,00', '40%'],
    ['Sobrancelha', 'R$ 2.985,00', 'R$ 7,75', 'R$ 1.442,75', '48,3%'],
    ['Hidratação', 'R$ 1.425,00', 'R$ 17,25', 'R$ 441,75', '31%'],
    ['Depilação', 'R$ 1.700,00', 'R$ 11,00', 'R$ 765,00', '45%'],
  ])(
    '%s: receita %s, custo %s por serviço, lucro %s, margem %s',
    (id, receita, custo, lucro, margem) => {
      const s = por[id]!;
      expect(formatarMoeda(s.receita)).toBe(receita);
      expect(formatarMoeda((s.custoProduto + s.comissao) / s.quantidade)).toBe(custo);
      expect(formatarMoeda(s.lucro)).toBe(lucro);
      expect(formatarFracao(s.margem)).toBe(margem);
    },
  );

  it('ordem: maior lucro primeiro', () => {
    expect(r.map((s) => s.servicoId)).toEqual([
      'Corte',
      'Barba',
      'Sobrancelha',
      'Depilação',
      'Hidratação',
    ]);
  });
});

describe('Dashboard de exemplo · ritmo, despesas e lucro do mês', () => {
  it('R$ 60.800 em 20 de 26 dias → projeção R$ 79.040; 1.215 clientes → 60,8 por dia e ticket R$ 50', () => {
    const dias = diasDeTrabalho('2026-03', [1, 2, 3, 4, 5, 6], []);
    const p = projetar(6_080_000, dias, dias[19]!);
    expect(p).toMatchObject({ diasTrabalhados: 20, diasDoMes: 26 });
    expect(formatarMoeda(p.projecao)).toBe('R$ 79.040,00');
    expect((1215 / 20).toLocaleString('pt-BR')).toBe('60,75');
    expect(Math.round(6_080_000 / 1215 / 100)).toBe(50);
  });

  it('despesas 74,7% do faturamento e lucro de R$ 15.400 (25,3%); investimento fora', () => {
    const r = calcularIndicadores(
      comandas(1, { ...item('mes', 1, 6_080_000), comissaoValor: 2_320_000 }),
      [
        { grupo: 'fixa', valor: 1_610_000 },
        { grupo: 'variavel', valor: 440_000 },
        { grupo: 'manutencao', valor: 170_000 },
        { grupo: 'investimento', valor: 150_000 },
      ],
    );
    expect(formatarFracao(r.percentualDespesas)).toBe('74,7%');
    expect(formatarMoeda(r.lucro)).toBe('R$ 15.400,00');
    expect(formatarFracao(r.lucro / r.faturamento)).toBe('25,3%');
  });
});

import { describe, expect, it } from 'vitest';
import {
  calcularIndicadores,
  diasDeTrabalho,
  lucratividadePorProduto,
  lucratividadePorServico,
  projetar,
  variacao,
  type ItemFechado,
} from './indicadores.js';

const servico = (
  preco: number,
  extra = false,
  peso = extra ? 0 : 1,
  comissao = 0,
  custo = 0,
  servicoId = extra ? 'extra' : 'corte',
): ItemFechado => ({
  tipo: 'servico',
  servicoId,
  quantidade: 1,
  precoUnitario: preco,
  desconto: 0,
  ehExtra: extra,
  pesoAtendimento: peso,
  custoUnitario: custo,
  comissaoValor: comissao,
});

describe('calcularIndicadores', () => {
  const comandas = [
    { itens: [servico(5000, false, 1, 2000, 150), servico(1500, true, 0, 600)] },
    { itens: [servico(7000, false, 2, 2800, 350, 'combo')] },
    // Só produto: entra no faturamento, mas não conta como cliente.
    {
      itens: [
        {
          ...servico(4500),
          tipo: 'produto' as const,
          servicoId: null,
          pesoAtendimento: 0,
          comissaoValor: 450,
          custoUnitario: 1800,
        },
      ],
    },
    // Não operacional fica fora do faturamento.
    {
      itens: [
        { ...servico(1000), tipo: 'nao_operacional' as const, servicoId: null, comissaoValor: 0 },
      ],
    },
  ];
  const despesas = [
    { grupo: 'fixa' as const, valor: 3000 },
    { grupo: 'variavel' as const, valor: 1000 },
    { grupo: 'retirada_dono' as const, valor: 9999 },
    { grupo: 'investimento' as const, valor: 5000 },
  ];
  const r = calcularIndicadores(comandas, despesas);

  it('faturamento: serviços + produtos, sem não operacional', () => {
    expect(r.faturamento).toBe(5000 + 1500 + 7000 + 4500);
    expect(r.receitaNaoOperacional).toBe(1000);
  });

  it('cliente = comanda fechada com pelo menos um serviço', () => {
    expect(r.clientes).toBe(2);
    expect(r.ticketMedio).toBe(Math.round(18000 / 2));
  });

  it('atendimentos pelo peso (combo pesa 2, extra 0)', () => {
    expect(r.atendimentos).toBe(3);
  });

  it('extras: quantidade, valor e percentual sobre clientes', () => {
    expect(r).toMatchObject({ extrasQuantidade: 1, extrasValor: 1500, percentualExtras: 0.5 });
  });

  it('% despesas: fixas + variáveis + manutenção + comissões; retirada e investimento fora', () => {
    const comissoes = 2000 + 600 + 2800 + 450;
    expect(r.comissoes).toBe(comissoes);
    expect(r.despesasOperacionais).toBe(3000 + 1000 + comissoes);
    expect(r.percentualDespesas).toBeCloseTo((4000 + comissoes) / 18000, 10);
    expect(r.lucro).toBe(18000 - (4000 + comissoes));
    expect(r.despesasPorGrupo.retirada_dono).toBe(9999);
  });

  it('desconto do item reduz o faturamento', () => {
    expect(
      calcularIndicadores([{ itens: [{ ...servico(5000), desconto: 500 }] }]).faturamento,
    ).toBe(4500);
  });

  it('mês sem nada não divide por zero', () => {
    expect(calcularIndicadores([])).toMatchObject({
      faturamento: 0,
      ticketMedio: 0,
      percentualExtras: 0,
      percentualDespesas: 0,
      percentualComissoes: 0,
    });
  });

  // Painel M5: "Despesas operacionais: 40%" com despesas zeradas; os 40% eram a comissão.
  it('a parte da comissão nos custos sai separada', () => {
    const i = calcularIndicadores([{ itens: [servico(4500, false, 1, 1800)] }], []);
    expect(i.percentualDespesas).toBe(0.4);
    expect(i.percentualComissoes).toBe(0.4);
    expect(i.percentualDespesas - i.percentualComissoes).toBe(0);
  });
});

describe('dias de trabalho e projeção', () => {
  // Novembro de 2026: 1º é domingo. Segunda a sábado = 25 dias; Finados (02) e 15 fecham.
  const dias = diasDeTrabalho(
    '2026-11',
    [1, 2, 3, 4, 5, 6],
    [
      { data: '2026-11-02', trabalha: false },
      { data: '2026-11-15', trabalha: false },
      { data: '2026-11-29', trabalha: true },
    ],
  );

  it('aplica dias da semana e exceções do calendário', () => {
    expect(dias).toHaveLength(25 - 1 + 1); // 15/11 é domingo (já fora); 29 (domingo) vira dia extra
    expect(dias).not.toContain('2026-11-02');
    expect(dias).toContain('2026-11-29');
  });

  it('projeção pelo ritmo dos dias trabalhados', () => {
    const p = projetar(100_000, dias, '2026-11-04');
    expect(p.diasTrabalhados).toBe(2); // 03 e 04 (01 domingo, 02 feriado)
    expect(p.projecao).toBe(Math.round((100_000 / 2) * 25));
    expect(p.fracaoDoMes).toBeCloseTo(2 / 25);
  });

  it('antes do primeiro dia trabalhado, a projeção é o próprio faturamento', () => {
    expect(projetar(0, dias, '2026-10-31').projecao).toBe(0);
  });
});

describe('lucratividade e variação', () => {
  it('lucro do serviço = receita − (custo de produto + comissão)', () => {
    const r = lucratividadePorServico([
      { itens: [servico(5000, false, 1, 2000, 150), servico(5000, false, 1, 2000, 150)] },
    ]);
    expect(r).toEqual([
      {
        servicoId: 'corte',
        quantidade: 2,
        receita: 10000,
        custoProduto: 300,
        comissao: 4000,
        lucro: 5700,
        margem: 0.57,
      },
    ]);
  });

  it('variação contra o período anterior', () => {
    expect(variacao(120, 100)).toBeCloseTo(0.2);
    expect(variacao(10, 0)).toBeNull();
    // Base negativa (prejuízo): ficar mais negativo é queda; sair do prejuízo é alta.
    expect(variacao(-1_373_261, -1_064_896)).toBeCloseTo(-0.29, 2);
    expect(variacao(500, -1000)).toBeCloseTo(1.5);
  });
});

describe('lucratividade por produto', () => {
  const produto = (
    produtoId: string,
    preco: number,
    custo: number,
    quantidade = 1,
    comissao = 0,
  ): ItemFechado => ({
    tipo: 'produto',
    produtoId,
    quantidade,
    precoUnitario: preco,
    desconto: 0,
    ehExtra: false,
    pesoAtendimento: 0,
    custoUnitario: custo,
    comissaoValor: comissao,
  });

  it('lucro, margem e retorno por real gasto no estoque', () => {
    const [pomada] = lucratividadePorProduto([{ itens: [produto('pomada', 4000, 1500, 2, 800)] }]);
    // Receita 8000 − (custo 3000 + comissão 800) = 4200.
    expect(pomada).toMatchObject({
      quantidade: 2,
      receita: 8000,
      custo: 3000,
      lucro: 4200,
      margem: 0.525,
      retornoSobreCusto: 1.4,
    });
  });

  it('vende × rende: investir, divulgar, rever preço, repensar e parado', () => {
    const r = lucratividadePorProduto(
      [
        // Pomada: vende muito e rende bem.
        { itens: [produto('pomada', 4000, 1000, 10)] },
        // Óleo: rende muito por unidade, mas sai pouco.
        { itens: [produto('oleo', 9000, 2000, 1)] },
        // Gel: sai bastante, mas quase não dá lucro.
        { itens: [produto('gel', 1500, 1400, 12)] },
        // Pente: pouco e sem lucro.
        { itens: [produto('pente', 1000, 1000, 1)] },
      ],
      ['pomada', 'oleo', 'gel', 'pente', 'shampoo'],
    );
    const situacao = Object.fromEntries(r.map((p) => [p.produtoId, p.situacao]));
    expect(situacao).toEqual({
      pomada: 'investir',
      oleo: 'divulgar',
      gel: 'rever_preco',
      pente: 'repensar',
      shampoo: 'parado',
    });
    // Mais lucro primeiro; parados no fim.
    expect(r.map((p) => p.produtoId)).toEqual(['pomada', 'oleo', 'gel', 'pente', 'shampoo']);
  });

  it('sem custo cadastrado, o retorno fica em branco (não divide por zero)', () => {
    expect(lucratividadePorProduto([{ itens: [produto('brinde', 500, 0)] }])[0]).toMatchObject({
      retornoSobreCusto: null,
      situacao: 'investir',
    });
  });

  it('serviço não entra na conta de produto', () => {
    expect(lucratividadePorProduto([{ itens: [servico(5000)] }])).toEqual([]);
  });
});

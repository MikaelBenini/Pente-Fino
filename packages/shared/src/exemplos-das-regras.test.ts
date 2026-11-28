// Os exemplos numéricos de docs/regras-de-negocio.md, rodando as funções de verdade. Se uma regra
// mudar, este teste quebra e lembra de atualizar o documento (Fase 0, 27/11/2026).
import { describe, expect, it } from 'vitest';
import { precoMinimoDoCorte, sobraDoCorte } from './calculadoras.js';
import { comissaoDoClube } from './clube.js';
import { comissaoItem } from './dinheiro.js';
import { proximoHorarioDeEnvio } from './estado-conversa.js';
import { calcularIndicadores, diasDeTrabalho, projetar } from './indicadores.js';
import { restanteAposSinal } from './sinal.js';
import { telefoneCanonico } from './whatsapp.js';
import { ehProativa, limiteProativasDoDia } from './protecao-whatsapp.js';

const item = (d: Partial<Parameters<typeof calcularIndicadores>[0][number]['itens'][number]>) => ({
  tipo: 'servico' as const,
  quantidade: 1,
  precoUnitario: 0,
  desconto: 0,
  ehExtra: false,
  pesoAtendimento: 1,
  custoUnitario: 0,
  comissaoValor: 0,
  ...d,
});

describe('exemplos de docs/regras-de-negocio.md', () => {
  it('E1 comissão do item: 40% de R$ 50,00 e valor fixo de R$ 15,00 em 2 unidades', () => {
    expect(comissaoItem(5000, 1, { percentualBp: 4000, valorFixo: null })).toBe(2000);
    expect(comissaoItem(3000, 2, { percentualBp: null, valorFixo: 1500 })).toBe(3000);
  });

  it('E2 indicadores do período', () => {
    const r = calcularIndicadores(
      [
        // Ana: corte e sobrancelha (extra).
        {
          itens: [
            item({ precoUnitario: 5000, comissaoValor: 2000, custoUnitario: 300 }),
            item({ precoUnitario: 1500, comissaoValor: 600, pesoAtendimento: 0, ehExtra: true }),
          ],
        },
        // Bruno: combo corte + barba (peso 2) e uma pomada.
        {
          itens: [
            item({
              precoUnitario: 8000,
              comissaoValor: 3200,
              custoUnitario: 500,
              pesoAtendimento: 2,
            }),
            item({
              tipo: 'produto',
              precoUnitario: 4000,
              comissaoValor: 400,
              custoUnitario: 2000,
              pesoAtendimento: 0,
            }),
          ],
        },
        // Caio, assinante do clube: corte coberto (valor zero; comissão sobre a tabela).
        { itens: [item({ precoUnitario: 0, comissaoValor: 2000, cobertoClube: true })] },
      ],
      [
        { grupo: 'fixa', valor: 8000 },
        { grupo: 'variavel', valor: 2000 },
        { grupo: 'investimento', valor: 30000 },
      ],
      { mensalidades: 9900 },
    );
    expect(r).toMatchObject({
      receitaServicos: 14500,
      receitaProdutos: 4000,
      receitaClube: 9900,
      faturamento: 28400,
      clientes: 3,
      clientesAvulsos: 2,
      ticketMedio: 9250,
      atendimentos: 4,
      atendimentosClube: 1,
      valorPorAtendimentoClube: 9900,
      extrasQuantidade: 1,
      extrasValor: 1500,
      comissoes: 8200,
      custoProdutos: 2800,
      despesasOperacionais: 18200,
      lucro: 10200,
    });
    expect(r.percentualExtras).toBeCloseTo(1 / 3);
    expect(r.percentualDespesas).toBeCloseTo(18200 / 28400);
  });

  it('E3 projeção do mês pelo calendário da unidade', () => {
    // Novembro de 2026, segunda a sábado, com folga no feriado de 02/11.
    const dias = diasDeTrabalho(
      '2026-11',
      [1, 2, 3, 4, 5, 6],
      [{ data: '2026-11-02', trabalha: false }],
    );
    expect(dias).toHaveLength(24);
    const p = projetar(1_200_000, dias, '2026-11-13');
    expect(p).toMatchObject({ diasTrabalhados: 10, diasDoMes: 24, projecao: 2_880_000 });
  });

  it('E4 sinal: abate do total no fechamento', () => {
    expect(restanteAposSinal(8000, [{ valor: 3000 }])).toBe(5000);
  });

  it('E5 comissão do clube: sobre a tabela, ou o valor fixo do dono', () => {
    const regra = { percentualBp: 4000, valorFixo: null };
    expect(
      comissaoDoClube({
        precoTabela: 5000,
        quantidade: 1,
        regraProfissional: regra,
        valorFixoClube: null,
      }),
    ).toBe(2000);
    expect(
      comissaoDoClube({
        precoTabela: 5000,
        quantidade: 1,
        regraProfissional: regra,
        valorFixoClube: 1500,
      }),
    ).toBe(1500);
  });

  it('E6 calculadoras: sobra do corte e preço mínimo', () => {
    expect(sobraDoCorte({ preco: 5000, comissaoPct: 40, produto: 300 })).toEqual({
      comissao: 2000,
      produto: 300,
      sobra: 2700,
    });
    expect(
      precoMinimoDoCorte({
        custosFixosMes: 600000,
        cortesMes: 400,
        comissaoPct: 40,
        produto: 300,
        margemPct: 20,
      }),
    ).toEqual({ preco: 4500, fixoPorCorte: 1500, comissao: 1800, margem: 900 });
  });

  it('E7 telefone do cliente com o nono dígito', () => {
    expect(telefoneCanonico('(44) 9976-4653')).toBe('5544999764653');
  });

  it('E9 pacote: entra no dia da venda; a sessão conta, mas fica fora do ticket', () => {
    const r = calcularIndicadores(
      [
        {
          itens: [
            item({ precoUnitario: 0, comissaoValor: 4000, pacoteClienteId: 'p1' }),
            item({ precoUnitario: 15000, comissaoValor: 6000 }),
          ],
        },
      ],
      [],
      { mensalidades: 0, pacotes: 24000 },
    );
    expect(r).toMatchObject({
      faturamento: 39000,
      receitaPacotes: 24000,
      receitaServicos: 15000,
      clientes: 1,
      atendimentos: 2,
      atendimentosPacote: 1,
      ticketMedio: 15000,
    });
    expect(
      comissaoDoClube({
        precoTabela: 10000,
        quantidade: 1,
        regraProfissional: { percentualBp: 4000 },
        valorFixoClube: null,
      }),
    ).toBe(4000);
  });

  it('E8 automático da madrugada sai às 7h', () => {
    expect(proximoHorarioDeEnvio(new Date('2026-11-20T23:30:00-03:00'))).toEqual(
      new Date('2026-11-21T07:00:00-03:00'),
    );
  });
});

describe('regras-de-negocio.md: proteção dos números de WhatsApp', () => {
  it('número conectado ontem: 20 proativas por dia; quem escreveu há pouco não conta', () => {
    const agora = new Date('2026-11-27T12:00:00-03:00');
    const ontem = new Date('2026-11-26T12:00:00-03:00');
    expect(limiteProativasDoDia(ontem, agora)).toBe(20);
    expect(ehProativa(agora.getTime() - 5 * 60_000, agora.getTime())).toBe(false);
    // O 21º lembrete criado às 12 h ficaria para amanhã às 9 h: 21 h depois, passa das 12 h e é
    // descartado (a regra de segurar vale até 12 h).
    const amanha9h = Date.parse('2026-11-28T09:00:00-03:00');
    expect((amanha9h - agora.getTime()) / 3_600_000).toBe(21);
  });
});

import { describe, expect, it } from 'vitest';
import {
  metricasDaPlataforma,
  situacaoNaPlataforma,
  type ContaParaMetricas,
  type FaturaParaMetricas,
} from './metricas-plataforma.js';

const agora = new Date('2026-11-20T15:00:00Z'); // 20/11, 12h em São Paulo
const dia = (iso: string) => new Date(`${iso}T15:00:00Z`);
const conta = (id: string, o: Partial<ContaParaMetricas>): ContaParaMetricas => ({
  id,
  plano: 'pro',
  ciclo: 'mensal',
  status: 'ativa',
  criadaEm: dia('2026-09-01'),
  testeAte: dia('2026-09-15'),
  cobrancaAutomatica: true,
  canceladaEm: null,
  motivoCancelamento: null,
  unidades: 1,
  ...o,
});
const paga = (contaId: string, vencimento: string, valor = 14990): FaturaParaMetricas => ({
  contaId,
  status: 'paga',
  vencimento,
  valor,
});

const contas = [
  // Pro mensal em dia, renovou duas vezes, automática.
  conta('a', {}),
  // Premium anual, 2 unidades, manual, em dia.
  conta('b', { plano: 'premium', ciclo: 'anual', unidades: 2, cobrancaAutomatica: false }),
  // Em teste, termina em 10 dias (entra na previsão).
  conta('c', { status: 'teste', criadaEm: dia('2026-11-16'), testeAte: dia('2026-11-30') }),
  // Teste acabou sem pagar (não converteu).
  conta('d', { status: 'teste', criadaEm: dia('2026-10-01'), testeAte: dia('2026-10-15') }),
  // Cancelou este mês, depois de pagar em outubro.
  conta('e', {
    status: 'cancelada',
    canceladaEm: dia('2026-11-10'),
    motivoCancelamento: 'Achou caro',
    plano: 'basico',
  }),
  // Criada hoje, em teste.
  conta('f', { status: 'teste', criadaEm: agora, testeAte: dia('2026-12-04') }),
];
const faturas = [
  paga('a', '2026-09-15'),
  paga('a', '2026-10-15'),
  paga('a', '2026-11-15'),
  paga('b', '2026-09-15', 28870 * 12),
  paga('e', '2026-10-15', 7990),
];

describe('métricas da plataforma', () => {
  const m = metricasDaPlataforma({ contas, faturas, agora });

  it('contas por situação e novas', () => {
    expect(m.contas.total).toBe(6);
    expect(m.contas.porSituacao).toMatchObject({
      em_dia: 2,
      teste: 2,
      teste_vencido: 1,
      cancelada: 1,
    });
    expect(m.novas).toMatchObject({ hoje: 1, ultimos7Dias: 2, noMes: 2 });
    expect(m.novas.porDia).toHaveLength(30);
    expect(m.novas.porDia.at(-1)).toEqual({ dia: '2026-11-20', contas: 1 });
  });

  it('MRR por plano e forma, ticket médio e previsão', () => {
    const premium = 20790 + 8290; // anual por mês, 2 unidades
    expect(m.receita).toMatchObject({
      mrr: 14990 + premium,
      porPlano: { basico: 0, pro: 14990, premium },
      porForma: { automatica: 14990, manual: premium },
      pagantes: 2,
      ticketMedio: Math.round((14990 + premium) / 2),
    });
    // Conversão de 3 em 4 que terminaram o teste (a, b, e pagaram; d não).
    expect(m.conversao).toEqual({ elegiveis: 4, assinaram: 3, taxa: 0.75 });
    // Previsão: os dois testes que terminam em 30 dias (c e f), vezes a conversão.
    expect(m.receita.previsaoProximoMes).toBe(m.receita.mrr + Math.round(2 * 14990 * 0.75));
  });

  it('cancelamentos do mês com motivo, e quem renovou', () => {
    // Base no começo do mês: a, b e e (pagaram antes de novembro).
    expect(m.cancelamentos).toEqual({
      noMes: 1,
      taxa: 1 / 3,
      motivos: [{ motivo: 'Achou caro', contas: 1 }],
    });
    expect(m.renovaram).toBe(1);
  });

  // Admin R5: a auditoria de 10/11 viu MRR R$ 0, "0 pagantes" e "Em dia 1" ao mesmo tempo.
  it('"em dia" só com pagamento; ativa que nunca pagou é "ativa sem cobrança"; cortesia à parte', () => {
    const ativa = { status: 'ativa' as const, testeAte: null };
    expect(situacaoNaPlataforma(ativa, [], agora)).toBe('ativa_sem_cobranca');
    expect(situacaoNaPlataforma(ativa, [{ status: 'paga', vencimento: '2026-11-05' }], agora)).toBe(
      'em_dia',
    );
    expect(situacaoNaPlataforma({ ...ativa, cortesiaAte: '2026-12-31' }, [], agora)).toBe(
      'cortesia',
    );
    // Cortesia acabou e ainda não pagou: volta a ser "ativa sem cobrança".
    expect(situacaoNaPlataforma({ ...ativa, cortesiaAte: '2026-11-19' }, [], agora)).toBe(
      'ativa_sem_cobranca',
    );
    const r = metricasDaPlataforma({
      agora,
      contas: [
        conta('sem', { testeAte: null }),
        conta('cortesia', { testeAte: null, cortesiaAte: '2026-12-31' }),
      ],
      faturas: [],
    });
    expect(r.contas.porSituacao).toMatchObject({ ativa_sem_cobranca: 1, cortesia: 1, em_dia: 0 });
    expect(r.receita).toMatchObject({ mrr: 0, pagantes: 0 });
  });

  it('conta interna fica fora de tudo (MRR, contas, novas, conversão) e é contada à parte', () => {
    const base = metricasDaPlataforma({ contas, faturas, agora });
    const interna = conta('equipe', { interna: true, criadaEm: agora, testeAte: null });
    const com = metricasDaPlataforma({
      contas: [...contas, interna],
      faturas: [
        ...faturas,
        { contaId: 'equipe', status: 'paga', vencimento: '2026-11-01', valor: 14990 },
      ],
      agora,
    });
    expect(com.contas.internas).toBe(1);
    expect(com.contas.total).toBe(base.contas.total);
    expect(com.receita).toEqual(base.receita);
    expect(com.novas).toEqual(base.novas);
    expect(com.conversao).toEqual(base.conversao);
    expect(com.renovaram).toBe(base.renovaram);
  });
});

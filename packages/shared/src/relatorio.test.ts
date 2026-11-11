import { describe, expect, it } from 'vitest';
import {
  compararMeses,
  custoELucroDoBarbeiro,
  frasesDoMes,
  mesAnteriorDe,
  mixDoMes,
  pontosDoBarbeiro,
  type BarbeiroDoMes,
  type NumerosDoMes,
} from './relatorio.js';

const mes = (x: Partial<NumerosDoMes> = {}): NumerosDoMes => ({
  faturamento: 1_000_000,
  lucro: 300_000,
  atendimentos: 200,
  clientes: 180,
  ticketMedio: 5_555,
  percentualExtras: 0.2,
  clientesNovos: 30,
  taxaRetorno: 0.5,
  faltas: 10,
  taxaFaltas: 0.05,
  notaMedia: 4.6,
  ocupacao: 0.6,
  porCanal: {},
  ...x,
});

describe('relatório do mês', () => {
  it('compara pela direção de cada indicador; mudança pequena é "igual"', () => {
    const l = compararMeses(
      mes({ faturamento: 1_120_000, taxaFaltas: 0.08, ticketMedio: 5_600, notaMedia: 4.4 }),
      mes(),
    );
    const de = (c: string) => l.find((x) => x.chave === c)!;
    expect(de('faturamento')).toMatchObject({ tendencia: 'melhorou' });
    expect(de('faturamento').variacao).toBeCloseTo(0.12);
    expect(de('taxaFaltas')).toMatchObject({ tendencia: 'piorou' });
    expect(de('taxaFaltas').variacao).toBeCloseTo(0.03); // em pontos
    expect(de('ticketMedio').tendencia).toBe('igual'); // +0,8%
    expect(de('notaMedia').tendencia).toBe('piorou');
  });

  it('ocupação da agenda: subir é melhor; sem expediente fica sem dado', () => {
    const subiu = compararMeses(mes({ ocupacao: 0.72 }), mes()).find(
      (x) => x.chave === 'ocupacao',
    )!;
    expect(subiu).toMatchObject({ tendencia: 'melhorou', formato: 'fracao' });
    expect(subiu.variacao).toBeCloseTo(0.12);
    expect(
      compararMeses(mes({ ocupacao: null }), mes()).find((x) => x.chave === 'ocupacao'),
    ).toMatchObject({ tendencia: 'igual', variacao: null });
    expect(frasesDoMes(compararMeses(mes({ ocupacao: 0.4 }), mes())).piorou).toContain(
      'A ocupação da agenda caiu 20 pontos',
    );
  });

  it('sem lucro real no plano, a linha de lucro some', () => {
    expect(
      compararMeses(mes({ lucro: null }), mes({ lucro: null })).map((x) => x.chave),
    ).not.toContain('lucro');
  });

  it('frases do que melhorou e piorou, as maiores primeiro', () => {
    const f = frasesDoMes(
      compararMeses(mes({ faturamento: 1_200_000, clientesNovos: 45, taxaFaltas: 0.09 }), mes()),
    );
    expect(f.melhorou[0]).toBe('Os clientes novos subiram 50%');
    expect(f.melhorou).toContain('O faturamento subiu 20%');
    expect(f.piorou).toEqual(['As faltas subiram 4 pontos']);
  });

  it('custo, lucro e pontos fortes e fracos do barbeiro contra a equipe', () => {
    const b = (x: Partial<BarbeiroDoMes>): BarbeiroDoMes => ({
      profissionalId: 'p',
      nome: 'Ana',
      faturamento: 600_000,
      comissao: 240_000,
      custoFixo: 100_000,
      custoProdutos: 30_000,
      atendimentos: 100,
      clientes: 90,
      ticketMedio: 6_000,
      percentualExtras: 0.2,
      taxaRetorno: 0.5,
      notaMedia: 4.5,
      faltas: 2,
      ocupacao: 0.6,
      percentualNoPrazo: 0.9,
      servicosMaisFeitos: [],
      faturamentoAnterior: 500_000,
      ...x,
    });
    const ana = b({ ticketMedio: 7_500, percentualExtras: 0.1, notaMedia: 4.9 });
    const beto = b({ nome: 'Beto', ticketMedio: 5_000, percentualExtras: 0.3, notaMedia: 4.3 });
    expect(custoELucroDoBarbeiro(ana)).toEqual({ custo: 340_000, lucro: 230_000 });
    const p = pontosDoBarbeiro(ana, [ana, beto]);
    expect(p.fortes).toContain('Ticket 20% acima da média');
    expect(p.fracos).toContain('Extras 50% abaixo da média');
    expect(p.fortes.some((t) => t.startsWith('Nota 4,9'))).toBe(true);
    // Sozinho na equipe: nada a comparar.
    expect(pontosDoBarbeiro(ana, [ana])).toEqual({ fortes: [], fracos: [] });
  });

  it('mix: participação na receita e na quantidade, com a variação', () => {
    const m = mixDoMes(
      [
        {
          tipo: 'servico',
          id: 'c',
          nome: 'Corte',
          quantidade: 75,
          receita: 375_000,
          lucro: 200_000,
        },
        {
          tipo: 'servico',
          id: 'b',
          nome: 'Barba',
          quantidade: 25,
          receita: 100_000,
          lucro: 50_000,
        },
        { tipo: 'produto', id: 'p', nome: 'Pomada', quantidade: 5, receita: 25_000, lucro: 10_000 },
      ],
      [{ tipo: 'servico', id: 'c', nome: 'Corte', quantidade: 60, receita: 300_000, lucro: 0 }],
    );
    expect(m[0]).toMatchObject({ nome: 'Corte', fatiaReceita: 0.75, fatiaQuantidade: 0.75 });
    expect(m[0]!.variacaoReceita).toBeCloseTo(0.25);
    expect(m.find((x) => x.nome === 'Barba')!.variacaoReceita).toBeNull();
    expect(m.find((x) => x.nome === 'Pomada')!.fatiaQuantidade).toBe(1);
  });

  it('mês anterior', () => {
    expect(mesAnteriorDe('2026-11')).toBe('2026-10');
    expect(mesAnteriorDe('2027-01')).toBe('2026-12');
  });
});

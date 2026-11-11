import { describe, expect, it } from 'vitest';
import {
  campoCsv,
  nomeDoMesPorExtenso,
  relatorioEmArquivo,
  relatorioEmCsv,
  textoDaVariacao,
} from './relatorio-arquivo.js';
import type { BarbeiroDoMes, NumerosDoMes, RelatorioDoMes } from './relatorio.js';

const numeros = (x: Partial<NumerosDoMes> = {}): NumerosDoMes => ({
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
  porCanal: { bot: 120, balcao: 60 },
  ...x,
});

const barbeiro = (x: Partial<BarbeiroDoMes>): BarbeiroDoMes => ({
  profissionalId: 'a',
  nome: 'Ana',
  faturamento: 600_000,
  comissao: 240_000,
  custoFixo: 100_000,
  custoProdutos: 30_000,
  atendimentos: 110,
  clientes: 100,
  ticketMedio: 6_000,
  percentualExtras: 0.25,
  taxaRetorno: 0.55,
  notaMedia: 4.8,
  faltas: 4,
  ocupacao: 0.7,
  percentualNoPrazo: 0.9,
  servicosMaisFeitos: [{ nome: 'Corte', quantidade: 80 }],
  faturamentoAnterior: 500_000,
  ...x,
});

const relatorio = (x: Partial<RelatorioDoMes> = {}): RelatorioDoMes => ({
  mes: '2026-10',
  mesAnterior: '2026-09',
  atual: numeros({ faturamento: 1_200_000 }),
  anterior: numeros(),
  barbeiros: [
    barbeiro({}),
    barbeiro({
      profissionalId: 'b',
      nome: 'Beto',
      faturamento: 400_000,
      ticketMedio: 4_000,
      custoFixo: 0,
      faturamentoAnterior: 0,
    }),
  ],
  mixAtual: [
    { tipo: 'servico', id: 's1', nome: 'Corte', quantidade: 150, receita: 900_000, lucro: 400_000 },
    { tipo: 'produto', id: 'p1', nome: 'Pomada', quantidade: 20, receita: 100_000, lucro: 40_000 },
  ],
  mixAnterior: [
    { tipo: 'servico', id: 's1', nome: 'Corte', quantidade: 120, receita: 750_000, lucro: 300_000 },
  ],
  periodoAnterior: { de: '2026-09-01', ate: '2026-09-30' },
  historico: [
    { mes: '2026-09', faturamento: 1_000_000, lucro: 300_000 },
    { mes: '2026-10', faturamento: 1_200_000, lucro: 350_000 },
  ],
  verLucro: true,
  verBarbeiros: true,
  projecao: null,
  ...x,
});

const contexto = { barbearia: 'Barbearia do João', unidade: 'Centro', parcial: false };

describe('relatório do mês em arquivo', () => {
  it('nomeia o mês por extenso', () => {
    expect(nomeDoMesPorExtenso('2026-01')).toBe('janeiro de 2026');
    expect(nomeDoMesPorExtenso('2026-12')).toBe('dezembro de 2026');
  });

  it('tem as mesmas seções da tela, com os números formatados', () => {
    const a = relatorioEmArquivo(relatorio(), contexto);
    expect(a.titulo).toBe('Barbearia do João');
    expect(a.subtitulo).toBe(
      'Relatório de outubro de 2026 comparado com setembro de 2026 · Centro',
    );
    expect(a.aviso).toBeNull();
    expect(a.tabelas.map((t) => t.titulo)).toEqual([
      'O mês em números',
      'O que melhorou e o que piorou',
      'Últimos 12 meses',
      'Por onde os clientes chegaram',
      'Barbeiros: quanto custam e quanto rendem',
      'Barbeiros: serviços, pontos fortes e a melhorar',
      'Serviços e produtos: quanto cada um pesa',
    ]);
    const numerosDoMes = a.tabelas[0]!;
    expect(numerosDoMes.linhas[0]).toEqual([
      'Faturamento',
      'R$ 12.000,00',
      'R$ 10.000,00',
      '+20%',
      'Melhorou',
    ]);
    expect(numerosDoMes.linhas.find((l) => l[0] === 'Agenda ocupada')).toEqual([
      'Agenda ocupada',
      '60%',
      '60%',
      '0 p.p.',
      'Estável',
    ]);
    expect(a.tabelas[1]!.linhas).toContainEqual(['Melhorou', 'O faturamento subiu 20%']);
  });

  it('barbeiro com custo, lucro, variação e pontos; quem é novo aparece como "novo"', () => {
    const t = relatorioEmArquivo(relatorio(), contexto).tabelas[4]!;
    const col = (nome: string) => t.colunas.findIndex((c) => c.titulo === nome);
    const ana = t.linhas[0]!;
    expect(ana[col('Barbeiro')]).toBe('Ana');
    expect(ana[col('Custa no mês (R$)')]).toBe('3.400,00');
    expect(ana[col('Lucro que gera (R$)')]).toBe('2.300,00'); // 6.000 − 300 − 3.400
    expect(ana[col('vs. mês anterior')]).toBe('+20%');
    expect(ana[col('Pontos fortes')]).toContain('Ticket');
    expect(t.linhas[1]![col('vs. mês anterior')]).toBe('novo');
    expect(t.linhas[1]![col('Lucro que gera (R$)')]).toBe('1.300,00'); // 4.000 − 300 − 2.400
  });

  it('sem lucro real no plano, nenhuma coluna de lucro', () => {
    const a = relatorioEmArquivo(
      relatorio({
        verLucro: false,
        atual: numeros({ lucro: null }),
        anterior: numeros({ lucro: null }),
      }),
      contexto,
    );
    const titulos = a.tabelas.flatMap((t) => t.colunas.map((c) => c.titulo));
    expect(titulos.some((x) => x.startsWith('Lucro'))).toBe(false);
    expect(a.tabelas[0]!.linhas.map((l) => l[0])).not.toContain('Lucro');
  });

  it('sem ficha e ranking no plano, o arquivo não traz os barbeiros', () => {
    const a = relatorioEmArquivo(relatorio({ verBarbeiros: false, barbeiros: [] }), contexto);
    expect(a.tabelas.map((t) => t.titulo).some((t) => t.startsWith('Barbeiros'))).toBe(false);
  });

  it('mix com % da quantidade, % da receita e variação', () => {
    const t = relatorioEmArquivo(relatorio(), contexto).tabelas.at(-1)!;
    expect(t.linhas[0]).toEqual([
      'Corte',
      'Serviço',
      '150',
      '100%',
      '9.000,00',
      '90%',
      '+20%',
      '4.000,00',
    ]);
    expect(t.linhas[1]![6]).toBe('novo');
  });

  it('no mês corrente, avisa que compara os mesmos dias; rede sem unidade', () => {
    const a = relatorioEmArquivo(
      relatorio({ periodoAnterior: { de: '2026-09-01', ate: '2026-09-11' } }),
      { ...contexto, unidade: null, parcial: true },
    );
    expect(a.aviso).toBe(
      'O mês ainda não acabou: a comparação é com os mesmos dias do mês anterior (1 a 11).',
    );
    expect(a.subtitulo.endsWith('· todas as unidades')).toBe(true);
  });

  it('CSV: BOM, ";", seções separadas, sem a tabela que só existe no PDF', () => {
    const csv = relatorioEmCsv(relatorioEmArquivo(relatorio(), contexto));
    expect(csv.startsWith('﻿Barbearia do João\r\n')).toBe(true);
    expect(csv).toContain('\r\n\r\nO MÊS EM NÚMEROS\r\nIndicador;outubro de 2026;');
    expect(csv).toContain('Faturamento;R$ 12.000,00;R$ 10.000,00;+20%;Melhorou');
    expect(csv).not.toContain('PONTOS FORTES E A MELHORAR');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('CSV: tabela vazia mostra o aviso no lugar das linhas', () => {
    const csv = relatorioEmCsv(
      relatorioEmArquivo(relatorio({ mixAtual: [], mixAnterior: [] }), contexto),
    );
    expect(csv).toContain('Nenhum serviço ou produto vendido no período.');
  });

  it('campo CSV: protege fórmula, mantém número com sinal e escapa aspas e ";"', () => {
    expect(campoCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(campoCsv('@soma')).toBe("'@soma");
    expect(campoCsv('+cmd|')).toBe("'+cmd|");
    expect(campoCsv('-2+3')).toBe("'-2+3");
    expect(campoCsv('+20%')).toBe('+20%');
    expect(campoCsv('-3 p.p.')).toBe('-3 p.p.');
    expect(campoCsv('-1.400,00')).toBe('-1.400,00');
    expect(campoCsv('-R$ 13.732,61')).toBe('-R$ 13.732,61');
    expect(campoCsv('-R$ 1+1')).toBe("'-R$ 1+1");
    expect(campoCsv('Corte; barba')).toBe('"Corte; barba"');
  });
});

describe('variação com os dois meses zerados (painel M2)', () => {
  it('conta nova não mostra "0% (estável)"', () => {
    const l = {
      atual: 0,
      anterior: 0,
      variacao: 0,
      formato: 'dinheiro',
      tendencia: 'igual',
    } as unknown as Parameters<typeof textoDaVariacao>[0];
    expect(textoDaVariacao(l)).toBe('sem dados ainda');
  });
});

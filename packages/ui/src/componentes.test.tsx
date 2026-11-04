import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BarraMeta, calcularBarraMeta } from './barra-meta.js';
import { EtiquetaEstado } from './etiqueta-estado.js';
import { aplicarColagem, interpretarColagem } from './tabela-editavel.js';

describe('calcularBarraMeta', () => {
  it('compara com o ritmo esperado para hoje', () => {
    expect(calcularBarraMeta({ atual: 1000, objetivo: 4000, fracaoDoMes: 0.5 }).situacao).toBe(
      'atrasada',
    );
    expect(calcularBarraMeta({ atual: 2000, objetivo: 4000, fracaoDoMes: 0.5 }).situacao).toBe(
      'no_ritmo',
    );
    expect(calcularBarraMeta({ atual: 2600, objetivo: 4000, fracaoDoMes: 0.5 }).situacao).toBe(
      'adiantada',
    );
    expect(calcularBarraMeta({ atual: 4100, objetivo: 4000, fracaoDoMes: 0.9 })).toMatchObject({
      situacao: 'batida',
      falta: 0,
    });
  });

  it('objetivo zero não divide por zero', () => {
    expect(calcularBarraMeta({ atual: 10, objetivo: 0, fracaoDoMes: 0.2 }).fracao).toBe(0);
  });
});

describe('colagem de planilha', () => {
  const colunas = [
    { chave: 'servico', rotulo: 'Serviço', somenteLeitura: true },
    { chave: 'centro', rotulo: 'Centro', tipo: 'moeda' as const },
    { chave: 'jardins', rotulo: 'Jardins', tipo: 'moeda' as const },
  ];

  it('interpreta linhas e colunas do Excel', () => {
    expect(interpretarColagem('45,00\t50,00\r\n35,00\t38,00\r\n')).toEqual([
      ['45,00', '50,00'],
      ['35,00', '38,00'],
    ]);
  });

  it('preenche a partir da célula e cria linhas que faltam', () => {
    const linhas = [{ servico: 'Corte', centro: '', jardins: '' }];
    const r = aplicarColagem(linhas, colunas, { linha: 0, coluna: 1 }, [
      ['45,00', '50,00'],
      ['35,00', '38,00'],
    ]);
    expect(r).toEqual([
      { servico: 'Corte', centro: '45,00', jardins: '50,00' },
      { servico: '', centro: '35,00', jardins: '38,00' },
    ]);
  });

  it('pula colunas somente leitura', () => {
    const r = aplicarColagem(
      [{ servico: 'Corte', centro: '', jardins: '' }],
      colunas,
      { linha: 0, coluna: 0 },
      [['45,00', '50,00']],
    );
    expect(r[0]).toEqual({ servico: 'Corte', centro: '45,00', jardins: '50,00' });
  });
});

describe('componentes', () => {
  it('etiqueta de estado sempre tem texto', () => {
    render(<EtiquetaEstado estado="em_atendimento" />);
    expect(screen.getByText('Em atendimento')).toBeDefined();
  });

  it('barra de meta descreve o ritmo para leitores de tela', () => {
    render(
      <BarraMeta
        rotulo="Faturamento"
        atual={1000}
        objetivo={4000}
        fracaoDoMes={0.5}
        formatar={(v) => `R$ ${v}`}
      />,
    );
    const medidor = screen.getByRole('meter', { name: 'Faturamento' });
    expect(medidor.getAttribute('aria-valuetext')).toBe(
      '25% da meta; pelo ritmo, hoje deveria estar em 50%',
    );
    expect(screen.getByText(/Abaixo do ritmo/)).toBeDefined();
  });
});

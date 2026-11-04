import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BarraMeta, calcularBarraMeta } from './barra-meta.js';
import { CampoQuantidade, limitarQuantidade } from './campo-quantidade.js';
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

describe('metas da planilha (print 3, A43:D49)', () => {
  // OBJETIVO × ATUAL → CONCLUÍDO, como a planilha mostra.
  it.each([
    ['faturamento', 2_970_000, 2_748_100, '92,5%'],
    ['sobrancelha', 70, 63, '90%'],
    ['depilação', 30, 51, '170%'],
    ['hidratação', 15, 14, '93,3%'],
    ['pezinho', 20, 34, '170%'],
  ])('%s: objetivo %i, atual %i → %s', (_, objetivo, atual, concluido) => {
    const c = calcularBarraMeta({ atual, objetivo, fracaoDoMes: 1 });
    expect(`${(c.fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`).toBe(
      concluido,
    );
    expect(c.situacao).toBe(c.fracao >= 1 ? 'batida' : 'atrasada');
  });

  it('PROBLEMA: a meta de barba express não tinha cálculo. Sistema: meta sem objetivo não divide por zero', () => {
    expect(calcularBarraMeta({ atual: 12, objetivo: 0, fracaoDoMes: 0.5 }).fracao).toBe(0);
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

describe('campo de quantidade', () => {
  it('limita ao intervalo e arredonda', () => {
    expect(limitarQuantidade(-3, 1, 50)).toBe(1);
    expect(limitarQuantidade(80, 1, 50)).toBe(50);
    expect(limitarQuantidade(2.6, 1, 50)).toBe(3);
  });

  it('não aceita negativo nem letra, e − e + respeitam o mínimo', () => {
    const valores: (number | null)[] = [];
    function Cadeiras() {
      const [v, setV] = useState<number | null>(1);
      return (
        <CampoQuantidade
          id="cadeiras"
          rotulo="Cadeiras"
          valor={v}
          min={1}
          max={50}
          onMudar={(n) => {
            valores.push(n);
            setV(n);
          }}
        />
      );
    }
    render(<Cadeiras />);
    const campo = screen.getByLabelText<HTMLInputElement>('Cadeiras');
    const menos = screen.getByRole<HTMLButtonElement>('button', { name: 'Diminuir cadeiras' });
    expect(menos.disabled).toBe(true);
    fireEvent.change(campo, { target: { value: '-5a' } });
    expect(campo.value).toBe('5');
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar cadeiras' }));
    expect(campo.value).toBe('6');
    fireEvent.change(campo, { target: { value: '0' } });
    fireEvent.blur(campo);
    expect(campo.value).toBe('1');
    expect(valores.at(-1)).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  avisosDisponiveis,
  lerAvisosEquipe,
  lerComandoEquipe,
  momentoProximoCliente,
  podeAvisarAgora,
  proximaRotina,
  textoAgendaEquipe,
  textoAjudaEquipe,
  textoFaltaGestao,
  textoNotaBaixa,
  textoProximoCliente,
  textoResumoGestao,
} from './assistente.js';

describe('lerComandoEquipe', () => {
  it.each([
    ['ATIVAR 123456', { tipo: 'ativar', codigo: '123456' }],
    ['ativar 123456', { tipo: 'ativar', codigo: '123456' }],
    ['Agenda', { tipo: 'agenda' }],
    ['amanhã', { tipo: 'amanha' }],
    ['Comissão', { tipo: 'comissao' }],
    ['Resumo do dia', { tipo: 'resumo' }],
    ['PARAR', { tipo: 'parar' }],
    ['ligar', { tipo: 'ligar' }],
    ['oi', { tipo: 'ajuda' }],
  ])('"%s"', (e, r) => expect(lerComandoEquipe(e)).toEqual(r));

  it('código errado ou outra frase não é comando', () => {
    expect(lerComandoEquipe('ativar 12345')).toBeNull();
    expect(lerComandoEquipe('qual meu próximo cliente?')).toBeNull();
  });
});

describe('podeAvisarAgora', () => {
  const turnos = [{ inicioMin: 9 * 60, fimMin: 19 * 60 }];
  it('uma hora antes do expediente até meia hora depois', () => {
    expect(podeAvisarAgora(turnos, 8 * 60)).toBe(true);
    expect(podeAvisarAgora(turnos, 7 * 60 + 59)).toBe(false);
    expect(podeAvisarAgora(turnos, 19 * 60 + 30)).toBe(true);
    expect(podeAvisarAgora(turnos, 19 * 60 + 31)).toBe(false);
  });
  it('dia sem expediente: nada sai', () => {
    expect(podeAvisarAgora([], 12 * 60)).toBe(false);
  });
});

describe('textos e avisos', () => {
  it('agenda com primeiro nome, serviços e quem confirmou', () => {
    expect(
      textoAgendaEquipe('Hoje (qui, 05/11)', [
        {
          inicio: '2026-11-05T12:00:00.000Z',
          cliente: 'João',
          servicos: ['Corte'],
          confirmado: true,
        },
        {
          inicio: '2026-11-05T13:00:00.000Z',
          cliente: 'Ana',
          servicos: ['Corte', 'Barba'],
          confirmado: false,
        },
      ]),
    ).toBe('Hoje (qui, 05/11): 2 horários\n\n09:00 · João · Corte ✓\n10:00 · Ana · Corte + Barba');
  });

  it('avisos: padrão ligado, gravado vale', () => {
    expect(lerAvisosEquipe(null)).toMatchObject({
      horarioNovo: true,
      mudancas: true,
      resumoDoDia: true,
    });
    expect(lerAvisosEquipe({ mudancas: false })).toMatchObject({
      horarioNovo: true,
      mudancas: false,
    });
  });
});

describe('avisos com hora marcada', () => {
  it('próximo cliente: 15 min antes; marcado em cima da hora não avisa', () => {
    const inicio = new Date('2026-11-06T17:00:00Z');
    expect(
      momentoProximoCliente(
        inicio,
        new Date('2026-11-05T10:00:00Z'),
        new Date('2026-11-06T12:00:00Z'),
      ),
    ).toEqual(new Date('2026-11-06T16:45:00Z'));
    expect(
      momentoProximoCliente(
        inicio,
        new Date('2026-11-06T16:50:00Z'),
        new Date('2026-11-06T16:50:00Z'),
      ),
    ).toBeNull();
  });

  it('agenda 1 h antes do primeiro turno; resumo 15 min depois do último; folga pula', () => {
    // Trabalha de terça a sábado, das 9h às 19h.
    const turnos = [2, 3, 4, 5, 6].map((diaSemana) => ({
      diaSemana,
      inicioMin: 540,
      fimMin: 1140,
    }));
    // Sábado, 07/11, 20:00 → agenda na terça 10/11 às 08:00 (domingo e segunda são folga).
    const sabadoNoite = new Date('2026-11-07T20:00:00-03:00');
    expect(proximaRotina(turnos, 'agenda', sabadoNoite)).toEqual({
      dia: '2026-11-10',
      quando: new Date('2026-11-10T08:00:00-03:00'),
    });
    // Sexta, 06/11, 10:00 → resumo no mesmo dia às 19:15.
    expect(proximaRotina(turnos, 'resumo', new Date('2026-11-06T10:00:00-03:00'))).toEqual({
      dia: '2026-11-06',
      quando: new Date('2026-11-06T19:15:00-03:00'),
    });
    expect(proximaRotina([], 'agenda', sabadoNoite)).toBeNull();
  });

  it('texto do próximo cliente diz se é a primeira vez', () => {
    expect(
      textoProximoCliente({
        inicio: '2026-11-06T17:00:00.000Z',
        cliente: 'João',
        servicos: ['Corte'],
        primeiraVez: true,
      }),
    ).toBe('⏰ Próximo cliente às 14:00: João (primeira vez) · Corte');
  });
});

describe('avisos de gestão', () => {
  it('cada um escolhe só os avisos que cabem a ele', () => {
    expect(avisosDisponiveis({ profissional: true, gestao: false })).not.toContain('faltas');
    expect(avisosDisponiveis({ profissional: false, gestao: true })).toEqual([
      'faltas',
      'notaBaixa',
      'resumoGestao',
    ]);
    expect(avisosDisponiveis({ profissional: true, gestao: true })).toHaveLength(8);
  });

  it('ajuda de quem só gere não fala de agenda nem comissão', () => {
    const t = textoAjudaEquipe({ profissional: false, gestao: true });
    expect(t).toContain('RESUMO');
    expect(t).not.toContain('COMISSÃO');
  });

  it('falta e nota baixa, com o comentário e o link do cliente', () => {
    expect(
      textoFaltaGestao({
        unidade: 'Centro',
        cliente: 'João Lima',
        profissional: 'Rafael',
        inicio: '2026-12-01T17:00:00.000Z',
      }),
    ).toBe('🚫 Falta · Centro\nJoão Lima não veio às 14:00 com Rafael.');
    expect(
      textoNotaBaixa({
        unidade: 'Centro',
        profissional: 'Rafael',
        cliente: 'João Lima',
        notaAtendimento: 2,
        notaBarbearia: null,
        comentario: 'Demorou',
        link: 'https://wa.me/5511999990000',
      }),
    ).toBe(
      '⚠️ Nota baixa · Centro\nJoão Lima, atendido por Rafael: atendimento 2\n"Demorou"\n\nFalar com o cliente: https://wa.me/5511999990000',
    );
  });

  it('resumo: uma unidade no título; várias em blocos; ticket só com cliente', () => {
    const centro = {
      unidade: 'Centro',
      faturamento: 30000,
      clientes: 4,
      faltas: 1,
      notasBaixas: 0,
      abertas: 2,
    };
    const t = textoResumoGestao('Resumo de hoje', [centro]);
    expect(t.split('\n')[0]).toBe('Resumo de hoje · Centro');
    expect(t).toMatch(/4 clientes · ticket R\$\s?75,00/);
    expect(t).toContain('🚫 1 falta');
    expect(t).toContain('⏳ 2 comandas esperando fechamento');
    expect(t).not.toContain('nota');
    const duas = textoResumoGestao('Resumo de hoje', [
      centro,
      { ...centro, unidade: 'Norte', faturamento: 0, clientes: 0 },
    ]);
    expect(duas).toContain('🏠 Norte');
    expect(duas).not.toMatch(/0 clientes · ticket/);
  });
});

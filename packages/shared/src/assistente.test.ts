import { describe, expect, it } from 'vitest';
import {
  lerAvisosEquipe,
  lerComandoEquipe,
  podeAvisarAgora,
  textoAgendaEquipe,
} from './assistente.js';

describe('lerComandoEquipe', () => {
  it.each([
    ['ATIVAR 123456', { tipo: 'ativar', codigo: '123456' }],
    ['ativar 123456', { tipo: 'ativar', codigo: '123456' }],
    ['Agenda', { tipo: 'agenda' }],
    ['amanhã', { tipo: 'amanha' }],
    ['Comissão', { tipo: 'comissao' }],
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
    expect(lerAvisosEquipe(null)).toEqual({ horarioNovo: true, mudancas: true });
    expect(lerAvisosEquipe({ mudancas: false })).toEqual({ horarioNovo: true, mudancas: false });
  });
});

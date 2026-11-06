import { describe, expect, it } from 'vitest';
import {
  deveAvisarClienteDoMovimento,
  minutosDoArrasto,
  textoConfirmarMovimento,
  textoHorarioMudou,
} from './mover.js';

const h = (hhmm: string) => new Date(`2026-12-01T${hhmm}:00-03:00`).toISOString();

describe('mover agendamento', () => {
  it('arrasto anda de 15 em 15 minutos', () => {
    expect(minutosDoArrasto(0, 1.4)).toBe(0);
    expect(minutosDoArrasto(10, 1.4)).toBe(0);
    expect(minutosDoArrasto(21, 1.4)).toBe(15);
    expect(minutosDoArrasto(-45, 1.4)).toBe(-30);
    expect(minutosDoArrasto(-5, 1.4)).toBe(0);
    expect(Object.is(minutosDoArrasto(-5, 1.4), -0)).toBe(false);
  });

  it('quando avisa o cliente', () => {
    expect(deveAvisarClienteDoMovimento({ mudouHorario: true, mudouBarbeiro: false })).toBe(true);
    expect(
      deveAvisarClienteDoMovimento({
        mudouHorario: true,
        mudouBarbeiro: true,
        avisarCliente: false,
      }),
    ).toBe(false);
    expect(deveAvisarClienteDoMovimento({ mudouHorario: false, mudouBarbeiro: true })).toBe(false);
    expect(
      deveAvisarClienteDoMovimento({
        mudouHorario: false,
        mudouBarbeiro: true,
        avisarCliente: true,
      }),
    ).toBe(true);
    expect(
      deveAvisarClienteDoMovimento({
        mudouHorario: false,
        mudouBarbeiro: false,
        avisarCliente: true,
      }),
    ).toBe(false);
  });

  it('texto da confirmação', () => {
    expect(
      textoConfirmarMovimento({
        servico: 'o Corte',
        cliente: 'João Silva',
        de: { inicio: h('14:00'), profissional: 'Rafael Moura' },
        para: { inicio: h('14:30'), profissional: 'Thiago Lima' },
      }),
    ).toBe('Mover o Corte do João das 14:00 com Rafael para 14:30 com Thiago?');
    expect(
      textoConfirmarMovimento({
        servico: 'o Corte',
        cliente: null,
        de: { inicio: h('14:00'), profissional: 'Rafael' },
        para: { inicio: h('15:00'), profissional: 'Rafael', diaRotulo: 'Amanhã (qua, 02/12)' },
      }),
    ).toBe('Mover o Corte das 14:00 com Rafael para Amanhã (qua, 02/12), 15:00?');
  });

  it('texto ao cliente', () => {
    expect(
      textoHorarioMudou({
        cliente: 'João Silva',
        diaRotulo: 'Hoje (ter, 01/12)',
        inicio: h('14:30'),
        profissional: 'Thiago Lima',
        mudouHorario: true,
        link: 'https://app/horario?t=x',
      }),
    ).toBe(
      'Oi, João! Seu horário mudou: agora é Hoje (ter, 01/12), às 14:30, com Thiago.\nSe não der para você, remarque ou cancele por aqui: https://app/horario?t=x',
    );
    expect(
      textoHorarioMudou({
        cliente: null,
        diaRotulo: 'Hoje (ter, 01/12)',
        inicio: h('14:00'),
        profissional: 'Thiago',
        mudouHorario: false,
        link: null,
      }),
    ).toBe(
      'Oi! Seu horário de Hoje (ter, 01/12), às 14:00 continua, agora com Thiago.\nSe não der para você, é só responder esta mensagem.',
    );
  });
});

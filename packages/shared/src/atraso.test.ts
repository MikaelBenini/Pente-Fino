import { describe, expect, it } from 'vitest';
import {
  estaAtrasado,
  proximosHorariosParaRemarcar,
  textoRemarcarAtraso,
  textoTolerancia,
} from './atraso.js';

const inicio = new Date('2026-12-01T17:00:00Z'); // 14:00 local
const em = (min: number) => new Date(inicio.getTime() + min * 60_000);

describe('tolerância de atraso', () => {
  const base = {
    statusComanda: 'prevista',
    statusAgendamento: 'agendado',
    inicio,
    toleranciaMin: 10,
  };
  it('só depois da tolerância e com a comanda ainda prevista', () => {
    expect(estaAtrasado({ ...base, agora: em(10) })).toBe(false);
    expect(estaAtrasado({ ...base, agora: em(11) })).toBe(true);
    expect(estaAtrasado({ ...base, agora: em(30), statusComanda: 'em_atendimento' })).toBe(false);
    expect(estaAtrasado({ ...base, agora: em(30), statusAgendamento: 'falta' })).toBe(false);
    expect(estaAtrasado({ ...base, agora: em(1), toleranciaMin: 0 })).toBe(true);
  });

  it('próximos 3 livres depois de agora, sem repetir', () => {
    const livres = [
      '2026-12-01T17:15:00.000Z',
      '2026-12-01T17:45:00.000Z',
      '2026-12-01T17:30:00.000Z',
      '2026-12-01T17:30:00.000Z',
      '2026-12-01T18:00:00.000Z',
      '2026-12-01T16:00:00.000Z',
    ];
    expect(proximosHorariosParaRemarcar(livres, em(20))).toEqual([
      '2026-12-01T17:30:00.000Z',
      '2026-12-01T17:45:00.000Z',
      '2026-12-01T18:00:00.000Z',
    ]);
  });

  it('textos da confirmação e da remarcação', () => {
    expect(textoTolerancia(10)).toBe(
      '⏱️ Tolerância de 10 minutos; depois disso o horário pode ser cancelado.',
    );
    expect(textoTolerancia(0)).toBeNull();
    expect(
      textoRemarcarAtraso({
        cliente: 'João',
        horaCancelada: inicio.toISOString(),
        opcoes: [{ inicio: '2026-12-01T17:30:00.000Z', rotulo: 'Hoje (ter, 01/12)' }],
        link: 'https://app/agendar?u=x&c=abc',
      }),
    ).toBe(
      'Oi, João. Seu horário das 14:00 foi cancelado pelo atraso. Quer remarcar?\n\n1. Hoje (ter, 01/12), às 14:30\n2. Outro dia (pelo site): https://app/agendar?u=x&c=abc\n0. Agora não\n\nResponda o número que eu já marco.',
    );
  });
});

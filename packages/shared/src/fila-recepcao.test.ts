import { describe, expect, it } from 'vitest';
import type { ComandaResumo } from './esquemas-operacao.js';
import { chegadaAtrasada, filaDaRecepcao } from './fila-recepcao.js';

function comanda(
  id: string,
  status: ComandaResumo['status'],
  inicio: string | null,
): ComandaResumo {
  return {
    id,
    unidadeId: 'u',
    profissionalId: 'p',
    profissional: 'Rafael',
    cliente: `Cliente ${id}`,
    clienteId: null,
    status,
    inicio,
    fim: null,
    totalLiquido: 0,
    servicos: [],
  };
}

const agora = new Date('2026-11-14T13:00:00Z');

describe('filaDaRecepcao', () => {
  it('separa em quem chega, na cadeira e para receber, em ordem de horário', () => {
    const f = filaDaRecepcao(
      [
        comanda('c', 'prevista', '2026-11-14T15:00:00Z'),
        comanda('a', 'prevista', '2026-11-14T14:00:00Z'),
        comanda('sem', 'prevista', null),
        comanda('b', 'em_atendimento', '2026-11-14T12:30:00Z'),
        comanda('r', 'confirmada', '2026-11-14T12:00:00Z'),
        comanda('p', 'pendente', '2026-11-14T11:00:00Z'),
        comanda('z', 'reaberta', '2026-11-14T10:00:00Z'),
        comanda('f', 'fechada', '2026-11-14T09:00:00Z'),
        comanda('x', 'cancelada', '2026-11-14T09:30:00Z'),
      ],
      agora,
    );
    expect(f.chegando.map((c) => c.id)).toEqual(['a', 'c', 'sem']);
    expect(f.proximo?.id).toBe('a');
    expect(f.naCadeira.map((c) => c.id)).toEqual(['b']);
    expect(f.paraReceber.map((c) => c.id)).toEqual(['z', 'p', 'r']);
    expect(f.atrasados).toBe(0);
  });

  it('o atrasado continua sendo o próximo e entra na conta dos atrasados', () => {
    const f = filaDaRecepcao(
      [
        comanda('atrasado', 'prevista', '2026-11-14T12:40:00Z'),
        comanda('depois', 'prevista', '2026-11-14T13:30:00Z'),
      ],
      agora,
    );
    expect(f.proximo?.id).toBe('atrasado');
    expect(f.atrasados).toBe(1);
  });

  it('dia vazio: sem próximo', () => {
    expect(filaDaRecepcao([], agora).proximo).toBeNull();
  });
});

describe('chegadaAtrasada', () => {
  it('dá 5 minutos de tolerância e só vale para previsto', () => {
    expect(chegadaAtrasada({ status: 'prevista', inicio: '2026-11-14T12:56:00Z' }, agora)).toBe(
      false,
    );
    expect(chegadaAtrasada({ status: 'prevista', inicio: '2026-11-14T12:54:00Z' }, agora)).toBe(
      true,
    );
    expect(
      chegadaAtrasada({ status: 'em_atendimento', inicio: '2026-11-14T12:00:00Z' }, agora),
    ).toBe(false);
    expect(chegadaAtrasada({ status: 'prevista', inicio: null }, agora)).toBe(false);
  });
});

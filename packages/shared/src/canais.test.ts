import { describe, expect, it } from 'vitest';
import { porCanal, type AgendamentoParaCanal } from './canais.js';

const ag = (
  origem: AgendamentoParaCanal['origem'],
  status: AgendamentoParaCanal['status'],
  total?: number,
): AgendamentoParaCanal => ({
  origem,
  status,
  comanda: total === undefined ? null : { status: 'fechada', totalLiquido: total },
});

describe('porCanal', () => {
  it('agendados, atendidos, faltas, cancelados, faturamento, fatia e comparecimento', () => {
    const r = porCanal(
      [
        ag('bot', 'atendido', 5000),
        ag('bot', 'atendido', 4000),
        ag('bot', 'falta'),
        ag('bot', 'cancelado'),
        ag('link', 'atendido', 3000),
        ag('balcao', 'agendado'),
      ],
      [{ totalLiquido: 3000 }],
    );
    expect(r.map((l) => l.canal)).toEqual(['bot', 'link', 'sem_horario', 'balcao']);
    expect(r[0]).toEqual({
      canal: 'bot',
      agendados: 4,
      atendidos: 2,
      faltas: 1,
      cancelados: 1,
      faturamento: 9000,
      fatia: 0.6,
      // 2 vieram de 3 que não cancelaram.
      comparecimento: 2 / 3,
    });
    expect(r[2]).toMatchObject({ canal: 'sem_horario', atendidos: 1, comparecimento: null });
  });

  it('sem movimento: lista vazia', () => {
    expect(porCanal([], [])).toEqual([]);
  });
});

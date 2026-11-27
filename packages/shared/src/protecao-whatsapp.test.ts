import { describe, expect, it } from 'vitest';
import {
  ehProativa,
  limiteProativasDoDia,
  pausaPorRisco,
  proximaProativa,
  tempoDigitandoMs,
} from './protecao-whatsapp.js';

const agora = new Date('2026-11-27T15:00:00Z');
const diasAtras = (d: number) => new Date(agora.getTime() - d * 86_400_000);

describe('proteção dos números de WhatsApp (27/11/2026)', () => {
  it('proativa é a automática para quem não escreveu nas últimas 24 horas', () => {
    expect(ehProativa(null, agora.getTime())).toBe(true);
    expect(ehProativa(agora.getTime() - 3_600_000, agora.getTime())).toBe(false);
    expect(ehProativa(agora.getTime() - 25 * 3_600_000, agora.getTime())).toBe(true);
  });

  it('aquecimento: número novo manda pouco, e o limite cresce com os dias', () => {
    expect(limiteProativasDoDia(null, agora)).toBe(20);
    expect(limiteProativasDoDia(diasAtras(0), agora)).toBe(20);
    expect(limiteProativasDoDia(diasAtras(4), agora)).toBe(50);
    expect(limiteProativasDoDia(diasAtras(10), agora)).toBe(100);
    expect(limiteProativasDoDia(diasAtras(30), agora)).toBe(200);
  });

  it('ritmo humano: de 25 a 45 segundos entre duas proativas do mesmo número', () => {
    const t = agora.getTime();
    expect(proximaProativa(null, t, 0.5)).toBe(t);
    expect(proximaProativa(t - 60_000, t, 0.5)).toBe(t);
    expect(proximaProativa(t - 5_000, t, 0)).toBe(t + 20_000);
    expect(proximaProativa(t - 5_000, t, 1)).toBe(t + 40_000);
  });

  it('"digitando..." proporcional ao texto, entre 1,2 s e 6 s', () => {
    expect(tempoDigitandoMs('Oi')).toBe(1_200);
    expect(tempoDigitandoMs('x'.repeat(100))).toBe(4_500);
    expect(tempoDigitandoMs('x'.repeat(1_000))).toBe(6_000);
  });

  it('pausa por falhas seguidas (6 h) ou por muita gente pedindo SAIR (24 h)', () => {
    expect(pausaPorRisco({ falhasRecentes: 5, saidas24h: 0, proativas24h: 10 }, agora)).toEqual({
      ate: new Date(agora.getTime() + 6 * 3_600_000),
      motivo: 'falhas',
    });
    expect(pausaPorRisco({ falhasRecentes: 0, saidas24h: 5, proativas24h: 100 }, agora)).toEqual({
      ate: new Date(agora.getTime() + 24 * 3_600_000),
      motivo: 'saidas',
    });
    // 5 SAIR em 200 proativas é 2,5%: abaixo dos 3%, segue.
    expect(pausaPorRisco({ falhasRecentes: 0, saidas24h: 5, proativas24h: 200 }, agora)).toBeNull();
    expect(pausaPorRisco({ falhasRecentes: 4, saidas24h: 4, proativas24h: 10 }, agora)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { lerNota, resumirNotas } from './avaliacao.js';

describe('lerNota', () => {
  it.each([
    ['5', 5],
    ['4.', 4],
    ['nota 3', 3],
    ['Dou 5!', 5],
    ['4/5', 4],
    ['4 de 5', 4],
    ['cinco', 5],
    ['5 estrelas', 5],
    ['⭐⭐⭐⭐', 4],
  ])('"%s" → %i', (entrada, nota) => expect(lerNota(entrada)).toBe(nota));

  it.each(['0', '10', '6', 'ótimo', '4 cortes', '', 'quero agendar'])('"%s" não é nota', (e) =>
    expect(lerNota(e)).toBeNull(),
  );
});

describe('resumirNotas', () => {
  it('média com uma casa e quantas de cada nota', () => {
    expect(resumirNotas([5, 4, 5, null, 2])).toEqual({
      media: 4,
      respostas: 4,
      distribuicao: [0, 1, 0, 1, 2],
    });
  });

  it('sem resposta, sem média', () => {
    expect(resumirNotas([])).toEqual({ media: null, respostas: 0, distribuicao: [0, 0, 0, 0, 0] });
  });
});

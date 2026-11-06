import { describe, expect, it } from 'vitest';
import { lerNota, resumirNotas, mereceConviteGoogle } from './avaliacao.js';
import { linkGoogleSchema } from './esquemas-bot.js';

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

describe('convite para o Google', () => {
  it('nota 5 da barbearia, ou do atendimento quando a da barbearia não veio; nunca com nota baixa', () => {
    expect(mereceConviteGoogle(5, 5)).toBe(true);
    expect(mereceConviteGoogle(4, 5)).toBe(true);
    expect(mereceConviteGoogle(5, null)).toBe(true);
    expect(mereceConviteGoogle(5, 4)).toBe(false);
    expect(mereceConviteGoogle(2, 5)).toBe(false);
  });

  it('link só com https; vazio desliga', () => {
    expect(linkGoogleSchema.parse({ link: '' })).toEqual({ link: null });
    expect(linkGoogleSchema.safeParse({ link: 'http://g.page/x' }).success).toBe(false);
    expect(linkGoogleSchema.parse({ link: 'https://g.page/r/x/review' }).link).toBe(
      'https://g.page/r/x/review',
    );
  });
});

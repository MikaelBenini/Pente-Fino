import { describe, expect, it } from 'vitest';
import { fazOsServicos, quemFaz, servicosDoProfissionalSchema } from './quem-faz.js';

const corte = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a51';
const barba = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a52';

describe('quem faz cada serviço (P5)', () => {
  it('lista vazia faz todos; com lista, só os marcados', () => {
    expect(fazOsServicos([], [corte, barba])).toBe(true);
    expect(fazOsServicos([corte], [corte])).toBe(true);
    expect(fazOsServicos([corte], [corte, barba])).toBe(false);
  });

  it('quem faz o serviço, na ordem', () => {
    const equipe = [
      { nome: 'Carlos', servicoIds: [] },
      { nome: 'Rafa', servicoIds: [corte] },
      { nome: 'Diego', servicoIds: [barba] },
    ];
    expect(quemFaz(equipe, barba).map((p) => p.nome)).toEqual(['Carlos', 'Diego']);
    expect(servicosDoProfissionalSchema.safeParse({ servicoIds: ['x'] }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { PAPEIS, papelSchema } from './papeis.js';

describe('papelSchema', () => {
  it('aceita os quatro papéis do sistema', () => {
    for (const papel of PAPEIS) {
      expect(papelSchema.parse(papel)).toBe(papel);
    }
  });

  it('recusa papel desconhecido', () => {
    expect(papelSchema.safeParse('admin').success).toBe(false);
  });
});

describe('papel profissional (27/11/2026)', () => {
  it('o nome antigo "barbeiro" ainda é aceito e vira "profissional"', () => {
    expect(papelSchema.parse('barbeiro')).toBe('profissional');
    expect(papelSchema.parse('profissional')).toBe('profissional');
    expect(papelSchema.safeParse('cabeleireiro').success).toBe(false);
  });
});

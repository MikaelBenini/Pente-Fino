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

import { describe, expect, it } from 'vitest';
import { fimDaSessaoSuporte } from './acesso-suporte.js';

const agora = new Date('2026-11-13T12:00:00Z');
const em = (min: number) => new Date(agora.getTime() + min * 60_000);

describe('fimDaSessaoSuporte (admin F5)', () => {
  it('sessão de 1 hora quando a liberação vai além', () => {
    expect(fimDaSessaoSuporte(em(600), agora)).toEqual(em(60));
  });
  it('acaba junto com a liberação quando ela termina antes de 1 hora', () => {
    expect(fimDaSessaoSuporte(em(20), agora)).toEqual(em(20));
  });
  it('sem liberação ou já vencida: não abre', () => {
    expect(fimDaSessaoSuporte(null, agora)).toBeNull();
    expect(fimDaSessaoSuporte(em(-1), agora)).toBeNull();
    expect(fimDaSessaoSuporte(agora, agora)).toBeNull();
  });
});

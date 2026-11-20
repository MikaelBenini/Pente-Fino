import { describe, expect, it } from 'vitest';
import {
  enderecoCompleto,
  linkDeMapaValido,
  linkMapaDaUnidade,
  mapaPodeErrar,
} from './endereco-unidade.js';

describe('endereço da unidade no mapa (testes de 19/11/2026)', () => {
  it('junta cidade e UF, sem repetir o que o endereço já tem', () => {
    expect(enderecoCompleto({ endereco: 'Rua jabora 123', cidade: 'Cascavel', uf: 'pr' })).toBe(
      'Rua jabora 123, Cascavel - PR',
    );
    expect(
      enderecoCompleto({ endereco: 'Rua jabora 123, Cascavel - PR', cidade: 'Cascavel', uf: 'PR' }),
    ).toBe('Rua jabora 123, Cascavel - PR');
    expect(enderecoCompleto({ endereco: 'Rua A, 1', uf: 'SP' })).toBe('Rua A, 1, SP');
    expect(enderecoCompleto({ endereco: null, cidade: 'Cascavel' })).toBeNull();
  });
  it('a busca leva cidade e UF; o link da barbearia vale no lugar', () => {
    expect(linkMapaDaUnidade({ endereco: 'Rua jabora 123', cidade: 'Cascavel', uf: 'PR' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20jabora%20123%2C%20Cascavel%20-%20PR',
    );
    expect(
      linkMapaDaUnidade({ endereco: 'Rua jabora 123', linkMapa: 'https://maps.app.goo.gl/abc123' }),
    ).toBe('https://maps.app.goo.gl/abc123');
  });
  it('aceita só link do Google Maps', () => {
    expect(linkDeMapaValido('https://www.google.com/maps/place/x')).toBe(true);
    expect(linkDeMapaValido('https://maps.app.goo.gl/abc')).toBe(true);
    expect(linkDeMapaValido('https://exemplo.com/maps')).toBe(false);
    expect(linkDeMapaValido('javascript:alert(1)')).toBe(false);
  });
  it('avisa quando o mapa pode errar de cidade', () => {
    expect(mapaPodeErrar({ endereco: 'Rua jabora 123' })).toBe(true);
    expect(mapaPodeErrar({ endereco: 'Rua jabora 123', cidade: 'Cascavel', uf: 'PR' })).toBe(false);
    expect(
      mapaPodeErrar({ endereco: 'Rua jabora 123', linkMapa: 'https://maps.app.goo.gl/a' }),
    ).toBe(false);
    expect(mapaPodeErrar({ endereco: null })).toBe(false);
  });
});

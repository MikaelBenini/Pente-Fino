import { describe, expect, it } from 'vitest';
import { CONTATO_OCULTO, ocultarContato } from './ocultar-contato.interceptor.js';

describe('ocultarContato (admin F5)', () => {
  it('troca telefone e WhatsApp em qualquer nível, sem mexer no resto', () => {
    expect(
      ocultarContato({
        nome: 'Ana',
        telefone: '5511999990000',
        itens: [{ cliente: { nome: 'Bia', whatsapp: '5511988880000' }, valor: 5000 }],
        vazio: { telefone: null },
      }),
    ).toEqual({
      nome: 'Ana',
      telefone: CONTATO_OCULTO,
      itens: [{ cliente: { nome: 'Bia', whatsapp: CONTATO_OCULTO }, valor: 5000 }],
      vazio: { telefone: null },
    });
  });

  it('data e valores simples passam como estão', () => {
    const d = new Date('2026-11-13T12:00:00Z');
    expect(ocultarContato({ quando: d, n: 1 })).toEqual({ quando: d, n: 1 });
    expect(ocultarContato('5511999990000')).toBe('5511999990000');
  });
});

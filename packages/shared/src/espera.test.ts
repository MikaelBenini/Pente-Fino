import { describe, expect, it } from 'vitest';
import { cabeNaFaixa, esperaSchema, ofertaValida, textoFaixa, textoOfertaVaga } from './espera.js';

describe('lista de espera', () => {
  it('a vaga cabe quando começa dentro da faixa pedida', () => {
    expect(cabeNaFaixa(9 * 60, 9 * 60, 12 * 60)).toBe(true);
    expect(cabeNaFaixa(12 * 60, 9 * 60, 12 * 60)).toBe(true);
    expect(cabeNaFaixa(12 * 60 + 15, 9 * 60, 12 * 60)).toBe(false);
    expect(textoFaixa(9 * 60, 12 * 60 + 30)).toBe('09:00 às 12:30');
  });

  it('a oferta vale 30 minutos e nunca depois do horário começar', () => {
    const enviadaEm = new Date('2026-12-01T12:00:00Z');
    const inicio = new Date('2026-12-01T14:00:00Z');
    expect(ofertaValida({ enviadaEm, inicio, agora: new Date('2026-12-01T12:29:00Z') })).toBe(true);
    expect(ofertaValida({ enviadaEm, inicio, agora: new Date('2026-12-01T12:31:00Z') })).toBe(
      false,
    );
    expect(
      ofertaValida({
        enviadaEm,
        inicio: new Date('2026-12-01T12:10:00Z'),
        agora: new Date('2026-12-01T12:15:00Z'),
      }),
    ).toBe(false);
  });

  it('texto da oferta: para quem pediu e para quem quer antecipar', () => {
    const base = {
      cliente: 'João',
      diaRotulo: 'Hoje (ter, 01/12)',
      inicio: '2026-12-01T13:30:00.000Z',
      profissional: 'Rafael',
    };
    expect(textoOfertaVaga({ ...base, antecipar: false })).toBe(
      'Oi, João! Vagou um horário que você pediu:\n\n📅 Hoje (ter, 01/12), às 10:30 com Rafael\n\n1. Quero\n2. Não, obrigado\n\nVale por 30 minutos; quem responder primeiro leva.',
    );
    expect(textoOfertaVaga({ ...base, antecipar: true })).toContain('1. Quero trocar para este');
  });

  it('entrada: cliente escolhido ou novo, e faixa em ordem', () => {
    const base = {
      unidadeId: '01a1ad82-1438-7789-8210-138154c53bf8',
      profissionalId: null,
      servicoIds: ['01a1ad82-1438-7789-8210-138154c53bf9'],
      dia: '2026-12-01',
      deMin: 540,
      ateMin: 720,
    };
    expect(esperaSchema.safeParse({ ...base, clienteNovo: { nome: 'Ana' } }).success).toBe(true);
    expect(esperaSchema.safeParse(base).success).toBe(false);
    expect(
      esperaSchema.safeParse({ ...base, clienteNovo: { nome: 'Ana' }, deMin: 800 }).success,
    ).toBe(false);
  });
});

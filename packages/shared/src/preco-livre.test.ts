import { describe, expect, it } from 'vitest';
import {
  conferirPrecoLivre,
  erroNaFaixaPrecoLivre,
  podeDigitarPrecoLivre,
  type RegraPrecoLivre,
} from './preco-livre.js';

const fixo: RegraPrecoLivre = { precoLivre: false, precoMinimo: null, precoMaximo: null };
const livre: RegraPrecoLivre = { precoLivre: true, precoMinimo: 8000, precoMaximo: 25000 };

describe('conferirPrecoLivre', () => {
  it('sem valor digitado, vale o preço da tabela (com ou sem preço livre)', () => {
    expect(conferirPrecoLivre(fixo, 4500)).toEqual({ ok: true, valor: 4500 });
    expect(conferirPrecoLivre(livre, 12000, null)).toEqual({ ok: true, valor: 12000 });
  });

  it('serviço de preço fixo recusa outro valor (desconto é pelo desconto)', () => {
    expect(conferirPrecoLivre(fixo, 4500, 3000)).toMatchObject({ ok: false, codigo: 'preco_fixo' });
    expect(conferirPrecoLivre(fixo, 4500, 4500)).toEqual({ ok: true, valor: 4500 });
  });

  it('preço livre aceita dentro da faixa e recusa fora, com a mensagem do limite', () => {
    expect(conferirPrecoLivre(livre, 12000, 18000)).toEqual({ ok: true, valor: 18000 });
    expect(conferirPrecoLivre(livre, 12000, 8000)).toEqual({ ok: true, valor: 8000 });
    expect(conferirPrecoLivre(livre, 12000, 7999)).toMatchObject({
      ok: false,
      codigo: 'abaixo_do_minimo',
      mensagem: expect.stringContaining('80,00'),
    });
    expect(conferirPrecoLivre(livre, 12000, 25001)).toMatchObject({
      ok: false,
      codigo: 'acima_do_maximo',
      mensagem: expect.stringContaining('250,00'),
    });
  });

  it('sem faixa, qualquer valor (inclusive zero, para cortesia registrada)', () => {
    const solto = { precoLivre: true, precoMinimo: null, precoMaximo: null };
    expect(conferirPrecoLivre(solto, 12000, 0)).toEqual({ ok: true, valor: 0 });
    expect(conferirPrecoLivre(solto, 12000, 99_000)).toEqual({ ok: true, valor: 99_000 });
  });
});

describe('erroNaFaixaPrecoLivre', () => {
  it('mínimo maior que o máximo é erro; o resto passa', () => {
    expect(erroNaFaixaPrecoLivre({ precoLivre: true, precoMinimo: 300, precoMaximo: 200 })).toBe(
      'O mínimo não pode ser maior que o máximo.',
    );
    expect(erroNaFaixaPrecoLivre(livre)).toBeNull();
    expect(
      erroNaFaixaPrecoLivre({ precoLivre: true, precoMinimo: 300, precoMaximo: null }),
    ).toBeNull();
    // Desligado: a faixa não importa.
    expect(
      erroNaFaixaPrecoLivre({ precoLivre: false, precoMinimo: 300, precoMaximo: 200 }),
    ).toBeNull();
  });
});

describe('podeDigitarPrecoLivre', () => {
  it('dono, gestor e recepção digitam; barbeiro só com a liberação', () => {
    expect(podeDigitarPrecoLivre(['recepcao'], false)).toBe(true);
    expect(podeDigitarPrecoLivre(['dono'], false)).toBe(true);
    expect(podeDigitarPrecoLivre(['barbeiro'], false)).toBe(false);
    expect(podeDigitarPrecoLivre(['barbeiro'], true)).toBe(true);
    expect(podeDigitarPrecoLivre(['barbeiro', 'gestor'], false)).toBe(true);
    expect(podeDigitarPrecoLivre([], true)).toBe(false);
  });
});

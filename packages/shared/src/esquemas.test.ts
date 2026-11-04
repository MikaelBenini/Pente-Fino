import { describe, expect, it } from 'vitest';
import { novoProfissionalSchema, servicoSchema, unidadeSchema } from './esquemas.js';
import { lerMoeda } from './formatacao.js';

describe('lerMoeda', () => {
  it.each([
    ['45', 4500],
    ['45,5', 4550],
    ['45,50', 4550],
    ['1.234,56', 123456],
    ['R$ 70,00', 7000],
    ['45.50', 4550],
    ['1.500', 150000],
    ['0,05', 5],
  ])('%s → %d', (t, c) => expect(lerMoeda(t)).toBe(c));

  it.each(['', 'abc', '45,555', '4,5,6', '1.2.3,4'])('recusa %s', (t) =>
    expect(lerMoeda(t)).toBeNull(),
  );
});

describe('unidadeSchema', () => {
  it('ordena dias sem repetir e completa DDI', () => {
    const u = unidadeSchema.parse({
      nome: 'Centro',
      diasTrabalho: [6, 1, 1, 2],
      capacidade: 3,
      telefone: '(11) 3000-0001',
    });
    expect(u.diasTrabalho).toEqual([1, 2, 6]);
    expect(u.telefone).toBe('551130000001');
  });

  it('exige pelo menos um dia', () => {
    expect(
      unidadeSchema.safeParse({ nome: 'Centro', diasTrabalho: [], capacidade: 1 }).success,
    ).toBe(false);
  });
});

describe('servicoSchema', () => {
  it('recusa custo em reais quebrados (só centavos inteiros)', () => {
    expect(
      servicoSchema.safeParse({
        nome: 'Corte',
        duracaoMin: 30,
        custoProduto: 1.5,
        ehExtra: false,
        pesoAtendimento: 1,
      }).success,
    ).toBe(false);
  });
});

describe('novoProfissionalSchema', () => {
  const base = {
    unidadeId: '019a4b2c-0000-7000-8000-000000000001',
    dataEntrada: '2026-11-03',
    comissaoServico: { percentualBp: 4000, valorFixo: null },
    comissaoProduto: { percentualBp: 1000, valorFixo: null },
  };

  it('aceita convite novo com nome e e-mail', () => {
    expect(
      novoProfissionalSchema.safeParse({ ...base, nome: 'Ana', email: 'ana@x.dev' }).success,
    ).toBe(true);
  });

  it('exige alguém da equipe ou dados do convite', () => {
    expect(novoProfissionalSchema.safeParse(base).success).toBe(false);
  });

  it('comissão: percentual ou fixo, não os dois', () => {
    const r = novoProfissionalSchema.safeParse({
      ...base,
      nome: 'Ana',
      email: 'a@x.dev',
      comissaoServico: { percentualBp: 4000, valorFixo: 100 },
    });
    expect(r.success).toBe(false);
  });
});

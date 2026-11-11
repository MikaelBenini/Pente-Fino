import { describe, expect, it } from 'vitest';
import {
  bloqueioSchema,
  novoProfissionalSchema,
  servicoSchema,
  unidadeParcialSchema,
} from './esquemas.js';
import { agendamentoPublicoSchema, cadastroContaSchema, slugSchema } from './publico.js';

describe('cadastroContaSchema', () => {
  const base = {
    barbearia: 'Barbearia X',
    nome: 'Ana',
    email: ' ANA@X.COM ',
    senha: 'senha-forte',
    aceite: true,
  };

  it('normaliza o e-mail e usa o plano básico por padrão', () => {
    expect(cadastroContaSchema.parse(base)).toMatchObject({ email: 'ana@x.com', plano: 'basico' });
  });

  it('exige aceite dos termos e senha de 8 caracteres', () => {
    expect(
      cadastroContaSchema.safeParse({ ...base, aceite: false }).error?.issues[0]?.message,
    ).toBe('É preciso aceitar os termos de uso.');
    expect(cadastroContaSchema.safeParse({ ...base, senha: '123' }).success).toBe(false);
  });

  it('recusa plano que não existe', () => {
    expect(cadastroContaSchema.safeParse({ ...base, plano: 'ouro' }).success).toBe(false);
  });
});

describe('agendamentoPublicoSchema', () => {
  const base = {
    nome: 'Cliente',
    telefone: '(11) 98888-7777',
    servicoIds: ['019a4b2c-0000-7000-8000-000000000001'],
    profissionalId: '019a4b2c-0000-7000-8000-000000000002',
    inicio: '2026-11-05T10:00:00-03:00',
  };

  it('completa o DDI do WhatsApp', () => {
    expect(agendamentoPublicoSchema.parse(base).telefone).toBe('5511988887777');
  });

  it.each([
    ['telefone sem DDD', { telefone: '98888-7777' }],
    ['sem serviço', { servicoIds: [] }],
    ['serviços demais', { servicoIds: Array(6).fill(base.servicoIds[0]) }],
    ['horário sem fuso', { inicio: '2026-11-05T10:00:00' }],
    ['nome vazio', { nome: ' ' }],
  ])('recusa %s', (_, mudanca) => {
    expect(agendamentoPublicoSchema.safeParse({ ...base, ...mudanca }).success).toBe(false);
  });
});

describe('slug do link', () => {
  it.each(['barbearia-centro', 'demo-1'])('aceita %s', (s) =>
    expect(slugSchema.safeParse(s).success).toBe(true),
  );
  it.each(['Barbearia', 'com espaço', '-comeca', 'termina-', 'a', 'duplo--hifen'])(
    'recusa %s',
    (s) => expect(slugSchema.safeParse(s).success).toBe(false),
  );

  it('na unidade, o endereço vira minúsculo', () => {
    expect(unidadeParcialSchema.parse({ slug: 'Demo-Centro' }).slug).toBe('demo-centro');
  });
});

describe('esquemas de cadastro: casos de borda', () => {
  it('serviço: duração mínima de 5 minutos e peso até 10', () => {
    const s = {
      nome: 'Corte',
      duracaoMin: 30,
      custoProduto: 0,
      ehExtra: false,
      pesoAtendimento: 1,
    };
    expect(servicoSchema.safeParse({ ...s, duracaoMin: 4 }).success).toBe(false);
    expect(servicoSchema.safeParse({ ...s, pesoAtendimento: 11 }).success).toBe(false);
    expect(servicoSchema.parse({ ...s, categoria: '' }).categoria).toBeNull();
  });

  it('bloqueio: o fim precisa ser depois do início', () => {
    expect(
      bloqueioSchema.safeParse({
        inicio: '2026-11-05T12:00:00-03:00',
        fim: '2026-11-05T11:00:00-03:00',
      }).success,
    ).toBe(false);
    expect(
      bloqueioSchema.safeParse({
        inicio: '2026-11-05T12:00:00-03:00',
        fim: '2026-11-05T13:00:00-03:00',
        motivo: 'Almoço',
      }).success,
    ).toBe(true);
  });

  it('profissional: comissão fixa em vez de percentual também vale', () => {
    const r = novoProfissionalSchema.safeParse({
      unidadeId: '019a4b2c-0000-7000-8000-000000000001',
      usuarioId: '019a4b2c-0000-7000-8000-000000000003',
      dataEntrada: '2026-11-01',
      comissaoServico: { percentualBp: null, valorFixo: 1500 },
      comissaoProduto: { percentualBp: 1000, valorFixo: null },
    });
    expect(r.success).toBe(true);
  });
});

describe('cadastro de conta: WhatsApp opcional (briefing do site, B8)', () => {
  const base = {
    barbearia: 'Barbearia do João',
    nome: 'João Silva',
    email: 'joao@exemplo.com',
    senha: 'umaSenhaBoa123',
    aceite: true as const,
  };
  it('sem o campo ou vazio: segue sem telefone', () => {
    expect(cadastroContaSchema.parse(base).whatsapp).toBeUndefined();
    expect(cadastroContaSchema.parse({ ...base, whatsapp: '' }).whatsapp).toBeNull();
    expect(cadastroContaSchema.parse({ ...base, whatsapp: null }).whatsapp).toBeNull();
  });
  it('com DDD vira 55 + número; incompleto é recusado', () => {
    expect(cadastroContaSchema.parse({ ...base, whatsapp: '(11) 98888-7777' }).whatsapp).toBe(
      '5511988887777',
    );
    expect(cadastroContaSchema.safeParse({ ...base, whatsapp: '98888-7777' }).success).toBe(false);
  });
});

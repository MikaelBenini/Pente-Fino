import { describe, expect, it } from 'vitest';
import { convidarUsuarioSchema, loginSchema, senhaSchema, trocarSenhaSchema } from './auth.js';

describe('loginSchema', () => {
  it('normaliza o e-mail', () => {
    expect(loginSchema.parse({ email: '  Dono@Barbearia.COM ', senha: 'x' }).email).toBe(
      'dono@barbearia.com',
    );
  });

  it('mensagem em português para e-mail inválido', () => {
    const r = loginSchema.safeParse({ email: 'nao-e-email', senha: 'x' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('E-mail inválido.');
  });
});

describe('senhaSchema', () => {
  it('exige 8 caracteres', () => {
    expect(senhaSchema.safeParse('1234567').success).toBe(false);
    expect(senhaSchema.safeParse('12345678').success).toBe(true);
  });
});

describe('trocarSenhaSchema', () => {
  it('recusa nova senha igual à atual', () => {
    const r = trocarSenhaSchema.safeParse({
      senhaAtual: 'senha-antiga',
      novaSenha: 'senha-antiga',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['novaSenha']);
  });
});

describe('convidarUsuarioSchema', () => {
  const base = { nome: 'Ana', email: 'ana@x.com', papel: 'barbeiro' as const };

  it('barbeiro precisa de unidade', () => {
    expect(convidarUsuarioSchema.safeParse(base).success).toBe(false);
  });

  it('dono pode valer em todas as unidades', () => {
    expect(convidarUsuarioSchema.parse({ ...base, papel: 'dono' }).unidadeId).toBeNull();
  });

  it('limpa a máscara do telefone', () => {
    const r = convidarUsuarioSchema.parse({
      ...base,
      unidadeId: '019a4b2c-0000-7000-8000-000000000001',
      telefone: '+55 (11) 99999-8888',
    });
    expect(r.telefone).toBe('5511999998888');
  });

  it('completa o DDI 55 quando vem só DDD e número', () => {
    const comum = { ...base, unidadeId: '019a4b2c-0000-7000-8000-000000000001' };
    expect(convidarUsuarioSchema.parse({ ...comum, telefone: '(11) 98888-7777' }).telefone).toBe(
      '5511988887777',
    );
    expect(convidarUsuarioSchema.parse({ ...comum, telefone: '11 3333-4444' }).telefone).toBe(
      '551133334444',
    );
    expect(convidarUsuarioSchema.safeParse({ ...comum, telefone: '9999' }).success).toBe(false);
  });
});

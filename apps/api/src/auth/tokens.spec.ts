import { SignJWT } from 'jose';
import { gerarTokenOpaco, hashToken, TokensAcesso } from './tokens.js';

const usuario = {
  id: '019a4b2c-0000-7000-8000-000000000001',
  contaId: '019a4b2c-0000-7000-8000-000000000002',
  papeis: [{ papel: 'gestor' as const, unidadeId: '019a4b2c-0000-7000-8000-000000000003' }],
};

describe('TokensAcesso', () => {
  const tokens = new TokensAcesso('segredo-de-teste-com-tamanho', 900);

  it('emite e verifica, preservando conta e papéis', async () => {
    expect(await tokens.verificar(await tokens.emitir(usuario))).toEqual(usuario);
  });

  it('recusa token assinado com outro segredo', async () => {
    const outro = new TokensAcesso('outro-segredo-qualquer-xxxxxx', 900);
    expect(await tokens.verificar(await outro.emitir(usuario))).toBeNull();
  });

  it('recusa token expirado', async () => {
    const expirado = await new SignJWT({ conta: usuario.contaId, papeis: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(usuario.id)
      .setIssuer('pente-fino')
      .setAudience('pente-fino-api')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(new TextEncoder().encode('segredo-de-teste-com-tamanho'));
    expect(await tokens.verificar(expirado)).toBeNull();
  });

  it('recusa lixo', async () => {
    expect(await tokens.verificar('nao.e.jwt')).toBeNull();
  });
});

describe('tokens opacos', () => {
  it('são longos, únicos e o hash é estável', () => {
    const a = gerarTokenOpaco();
    expect(a).toHaveLength(43);
    expect(a).not.toBe(gerarTokenOpaco());
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
  });
});

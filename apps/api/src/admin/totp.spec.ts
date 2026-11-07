import { randomBytes } from 'node:crypto';
import {
  base32,
  cifrar,
  codigoDoPasso,
  conferirCodigo,
  decifrar,
  deBase32,
  enderecoOtpauth,
  novoSegredo,
  passoDe,
} from './totp.js';

// Vetor da RFC 6238 (SHA-1): segredo "12345678901234567890".
const SEGREDO_RFC = base32(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('base32 vai e volta', () => {
    expect(SEGREDO_RFC).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(deBase32(SEGREDO_RFC).toString()).toBe('12345678901234567890');
    expect(novoSegredo()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('bate com os vetores da RFC 6238', () => {
    expect(codigoDoPasso(SEGREDO_RFC, passoDe(new Date(59_000)), 8)).toBe('94287082');
    expect(codigoDoPasso(SEGREDO_RFC, passoDe(new Date(1_111_111_109_000)), 8)).toBe('07081804');
    expect(codigoDoPasso(SEGREDO_RFC, passoDe(new Date(1_234_567_890_000)), 8)).toBe('89005924');
  });

  it('aceita um passo de folga, recusa o resto e não aceita o mesmo código duas vezes', () => {
    const agora = new Date('2026-11-07T12:00:10Z');
    const passo = passoDe(agora);
    const atual = codigoDoPasso(SEGREDO_RFC, passo);
    expect(conferirCodigo(SEGREDO_RFC, atual, agora)).toBe(passo);
    expect(conferirCodigo(SEGREDO_RFC, codigoDoPasso(SEGREDO_RFC, passo - 1), agora)).toBe(
      passo - 1,
    );
    expect(conferirCodigo(SEGREDO_RFC, codigoDoPasso(SEGREDO_RFC, passo - 3), agora)).toBeNull();
    expect(conferirCodigo(SEGREDO_RFC, atual, agora, passo)).toBeNull();
    expect(conferirCodigo(SEGREDO_RFC, '12345', agora)).toBeNull();
    expect(conferirCodigo(SEGREDO_RFC, 'abcdef', agora)).toBeNull();
  });

  it('endereço do QR e cifra do segredo', () => {
    expect(enderecoOtpauth('ana@pentefino.dev', 'ABC')).toBe(
      'otpauth://totp/Pente%20Fino%20Admin%3Aana%40pentefino.dev?secret=ABC&issuer=Pente%20Fino%20Admin&digits=6&period=30',
    );
    const chave = randomBytes(32);
    const c = cifrar(SEGREDO_RFC, chave);
    expect(c).not.toContain(SEGREDO_RFC);
    expect(decifrar(c, chave)).toBe(SEGREDO_RFC);
    expect(() => decifrar(c, randomBytes(32))).toThrow();
  });
});

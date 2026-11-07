// Cifra de segredos guardados pela administração (segundo fator, senha do SMTP): AES-256-GCM com
// a PLATAFORMA_CHAVE (32 bytes). Formato: iv(12) + tag(16) + texto, em base64.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function cifrar(texto: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave, iv);
  const corpo = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corpo]).toString('base64');
}

export function decifrar(cifrado: string, chave: Buffer): string {
  const b = Buffer.from(cifrado, 'base64');
  const d = createDecipheriv('aes-256-gcm', chave, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

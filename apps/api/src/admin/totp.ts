// Segundo fator de quem administra: código de 6 dígitos do aplicativo autenticador (TOTP,
// RFC 6238: HMAC-SHA1, passo de 30 s). O segredo fica cifrado no banco (AES-256-GCM).
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PASSO_S = 30;
const DIGITOS = 6;
/** Aceita o passo anterior e o seguinte (relógio do celular um pouco fora). */
const JANELA = 1;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = '';
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      saida += BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += BASE32[(valor << (5 - bits)) & 31];
  return saida;
}

export function deBase32(texto: string): Buffer {
  const limpo = texto.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of limpo) {
    const i = BASE32.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Segredo novo: 20 bytes aleatórios em base32 (o que o aplicativo lê). */
export const novoSegredo = () => base32(randomBytes(20));

export const passoDe = (agora: Date) => Math.floor(agora.getTime() / 1000 / PASSO_S);

export function codigoDoPasso(segredo: string, passo: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', deBase32(segredo)).update(contador).digest();
  const deslocamento = h[h.length - 1]! & 0xf;
  const numero = (h.readUInt32BE(deslocamento) & 0x7fffffff) % 10 ** digitos;
  return String(numero).padStart(digitos, '0');
}

/**
 * Confere o código; devolve o passo aceito ou null. Código de um passo já usado (ou anterior)
 * não entra de novo: quem viu o código na tela não consegue reaproveitar.
 */
export function conferirCodigo(
  segredo: string,
  codigo: string,
  agora: Date,
  ultimoPasso: number | null = null,
): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const atual = passoDe(agora);
  for (let d = -JANELA; d <= JANELA; d++) {
    const passo = atual + d;
    if (ultimoPasso !== null && passo <= ultimoPasso) continue;
    const esperado = Buffer.from(codigoDoPasso(segredo, passo));
    if (timingSafeEqual(esperado, Buffer.from(codigo))) return passo;
  }
  return null;
}

/** Endereço que o aplicativo autenticador lê no QR code. */
export function enderecoOtpauth(email: string, segredo: string): string {
  const rotulo = encodeURIComponent(`Pente Fino Admin:${email}`);
  return `otpauth://totp/${rotulo}?secret=${segredo}&issuer=${encodeURIComponent('Pente Fino Admin')}&digits=${DIGITOS}&period=${PASSO_S}`;
}

// Código do aplicativo autenticador (TOTP, RFC 6238) para os testes de navegador: o teste lê a
// chave mostrada na configuração do segundo fator e calcula o código como o celular faria.
import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function deBase32(texto: string): Buffer {
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of texto.replace(/=+$/, '').toUpperCase()) {
    valor = (valor << 5) | BASE32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const passoDe = (agora: Date) => Math.floor(agora.getTime() / 30_000);

export function codigoDoPasso(segredo: string, passo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', deBase32(segredo)).update(contador).digest();
  const deslocamento = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

// Pix estático da barbearia (BR Code, padrão EMV do Banco Central): o "copia e cola" e o QR da
// mensalidade do clube, sem gateway. A recepção confere o recebimento e dá baixa.
import { z } from 'zod';

const campo = (id: string, valor: string) =>
  `${id}${String(valor.length).padStart(2, '0')}${valor}`;

/** Sem acento, maiúsculo e só o que o padrão aceita; corta no tamanho máximo. */
const limpar = (t: string, max: number) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-/]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, max);

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como o BR Code pede. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface DadosPix {
  chave: string;
  /** Nome de quem recebe (até 25 caracteres). */
  nome: string;
  /** Cidade de quem recebe (até 15 caracteres). */
  cidade: string;
  /** Centavos; sem valor, o cliente digita. */
  valor?: number;
  /** Identificador que aparece no extrato (até 25, letras e números). */
  identificador?: string;
}

/** O "Pix copia e cola" (também é o conteúdo do QR). */
export function pixCopiaECola(d: DadosPix): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', d.chave.trim());
  const txid = (d.identificador ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const semCrc =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (d.valor ? campo('54', (d.valor / 100).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(d.nome, 25) || 'RECEBEDOR') +
    campo('60', limpar(d.cidade, 15) || 'BRASIL') +
    campo('62', campo('05', txid)) +
    '6304';
  return semCrc + crc16(semCrc);
}

/** Chave Pix: e-mail, telefone (+55…), CPF/CNPJ (só dígitos) ou chave aleatória. */
export const chavePixSchema = z
  .string()
  .trim()
  .min(5, { error: 'Informe a chave Pix.' })
  .max(77)
  .refine(
    (c) =>
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ||
      /^\+55\d{10,11}$/.test(c) ||
      /^\d{11}$|^\d{14}$/.test(c) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c),
    { error: 'Use e-mail, telefone com +55, CPF ou CNPJ (só números) ou a chave aleatória.' },
  );

export const recebimentoPixSchema = z.object({
  chave: chavePixSchema,
  nome: z.string().trim().min(2).max(60),
  cidade: z.string().trim().min(2).max(40),
});
export type RecebimentoPix = z.infer<typeof recebimentoPixSchema>;

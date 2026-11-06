import { describe, expect, it } from 'vitest';
import { chavePixSchema, crc16, pixCopiaECola } from './pix.js';

describe('Pix copia e cola (BR Code)', () => {
  it('CRC16-CCITT confere com o valor de referência', () => {
    // "123456789" → 0x29B1 no CRC-16/CCITT-FALSE.
    expect(crc16('123456789')).toBe('29B1');
  });

  it('monta os campos na ordem do padrão, com valor e identificador, e fecha com o CRC', () => {
    const codigo = pixCopiaECola({
      chave: 'barbearia@exemplo.com',
      nome: 'Barbearia São João Ltda',
      cidade: 'São Paulo',
      valor: 9990,
      identificador: 'CLUBE-0123',
    });
    expect(codigo.startsWith('000201')).toBe(true);
    expect(codigo).toContain('0014br.gov.bcb.pix0121barbearia@exemplo.com');
    expect(codigo).toContain('520400005303986540599.905802BR');
    expect(codigo).toContain('5923BARBEARIA SAO JOAO LTDA'.slice(0, 27));
    expect(codigo).toContain('6009SAO PAULO');
    expect(codigo).toContain('62130509CLUBE0123');
    const semCrc = codigo.slice(0, -4);
    expect(semCrc.endsWith('6304')).toBe(true);
    expect(codigo.slice(-4)).toBe(crc16(semCrc));
  });

  it('sem valor nem identificador: o cliente digita e o txid vira ***', () => {
    const codigo = pixCopiaECola({ chave: '12345678901', nome: 'X', cidade: 'Y' });
    expect(codigo).not.toContain('5404');
    expect(codigo).toContain('62070503***');
  });

  it('chave: e-mail, +55, CPF/CNPJ e aleatória; o resto é recusado', () => {
    for (const ok of [
      'a@b.co',
      '+5511999998888',
      '12345678901',
      '12345678000199',
      '123e4567-e89b-12d3-a456-426614174000',
    ])
      expect(chavePixSchema.safeParse(ok).success).toBe(true);
    for (const ruim of ['+551199', 'barbearia', '123.456.789-01'])
      expect(chavePixSchema.safeParse(ruim).success).toBe(false);
  });
});

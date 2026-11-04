import { describe, expect, it } from 'vitest';
import {
  INTERVALO_MINIMO_ENVIO_MS,
  LIMITE_ENVIOS_POR_MINUTO,
  proximoEnvio,
  telefoneDoJid,
  VARIACAO_ENVIO_MS,
  variantesTelefone,
} from './whatsapp.js';

describe('telefoneDoJid', () => {
  it('lê o número de uma conversa individual', () => {
    expect(telefoneDoJid('5511988887777@s.whatsapp.net')).toBe('5511988887777');
    expect(telefoneDoJid('5511988887777:12@s.whatsapp.net')).toBe('5511988887777');
    expect(telefoneDoJid('5511988887777@c.us')).toBe('5511988887777');
  });

  it('ignora grupo, transmissão, status e identificador oculto', () => {
    expect(telefoneDoJid('120363025@g.us')).toBeNull();
    expect(telefoneDoJid('status@broadcast')).toBeNull();
    expect(telefoneDoJid('123456@lid')).toBeNull();
    expect(telefoneDoJid('')).toBeNull();
    expect(telefoneDoJid(undefined)).toBeNull();
  });
});

describe('variantesTelefone', () => {
  it('celular com nono dígito também é procurado sem ele', () => {
    expect(variantesTelefone('5511988887777')).toEqual(['5511988887777', '551188887777']);
  });

  it('celular sem nono dígito ganha a forma com ele primeiro', () => {
    expect(variantesTelefone('551188887777')).toEqual(['5511988887777', '551188887777']);
  });

  it('fixo e número de fora ficam como vieram', () => {
    expect(variantesTelefone('551133334444')).toEqual(['551133334444']);
    expect(variantesTelefone('14155550100')).toEqual(['14155550100']);
  });
});

describe('proximoEnvio', () => {
  const agora = 1_000_000;

  it('primeira mensagem sai logo, com a variação', () => {
    expect(proximoEnvio(null, agora, 0)).toBe(agora);
    expect(proximoEnvio(null, agora, 1)).toBe(agora + VARIACAO_ENVIO_MS);
  });

  it('respeita o intervalo mínimo depois da última agendada', () => {
    expect(proximoEnvio(agora, agora, 0)).toBe(agora + INTERVALO_MINIMO_ENVIO_MS);
    expect(proximoEnvio(agora + 10_000, agora, 0.5)).toBe(
      agora + 10_000 + INTERVALO_MINIMO_ENVIO_MS + VARIACAO_ENVIO_MS / 2,
    );
  });

  it('última mensagem antiga não atrasa a próxima', () => {
    expect(proximoEnvio(agora - 60_000, agora, 0)).toBe(agora);
  });

  it('nunca passa do limite por minuto, mesmo sem variação', () => {
    let ultimo: number | null = null;
    const horarios: number[] = [];
    for (let i = 0; i < 100; i++) {
      ultimo = proximoEnvio(ultimo, agora, 0);
      horarios.push(ultimo);
    }
    const noPrimeiroMinuto = horarios.filter((h) => h < agora + 60_000).length;
    expect(noPrimeiroMinuto).toBeLessThanOrEqual(LIMITE_ENVIOS_POR_MINUTO);
  });

  it('aleatório fora de 0..1 é contido', () => {
    expect(proximoEnvio(null, agora, 7)).toBe(agora + VARIACAO_ENVIO_MS);
    expect(proximoEnvio(null, agora, -1)).toBe(agora);
  });
});

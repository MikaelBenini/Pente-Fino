import { describe, expect, it } from 'vitest';
import {
  assinarInstancia,
  assinaturaValida,
  instanciaDoWebhook,
  lerWebhookEvolution,
} from './webhook.js';

const agora = new Date('2026-11-04T17:00:00Z');
const mensagem = (data: object, extra: object = {}) => ({
  event: 'messages.upsert',
  instance: 'pf-unidade',
  data: {
    key: { remoteJid: '5511988887777@s.whatsapp.net', fromMe: false, id: 'ABC123' },
    pushName: 'João Silva',
    message: { conversation: 'oi' },
    messageTimestamp: 1_793_811_600,
    ...data,
  },
  ...extra,
});

describe('assinatura da instância', () => {
  it('confere a assinatura certa e recusa a errada', () => {
    const a = assinarInstancia('segredo', 'pf-1');
    expect(assinaturaValida('segredo', 'pf-1', a)).toBe(true);
    expect(assinaturaValida('segredo', 'pf-2', a)).toBe(false);
    expect(assinaturaValida('outro', 'pf-1', a)).toBe(false);
    expect(assinaturaValida('segredo', 'pf-1', 'curta')).toBe(false);
    expect(assinaturaValida('segredo', 'pf-1', undefined)).toBe(false);
  });
});

describe('lerWebhookEvolution', () => {
  it('mensagem de texto vira evento com telefone, nome e horário', () => {
    expect(lerWebhookEvolution(mensagem({}), agora)).toEqual({
      tipo: 'mensagem',
      instancia: 'pf-unidade',
      idExterno: 'ABC123',
      telefone: '5511988887777',
      nome: 'João Silva',
      texto: 'oi',
      recebidaEm: new Date(1_793_811_600_000).toISOString(),
    });
  });

  it('lê texto estendido, legenda de foto e resposta de lista', () => {
    const texto = (message: object) =>
      (lerWebhookEvolution(mensagem({ message }), agora) as { texto: string }).texto;
    expect(texto({ extendedTextMessage: { text: 'qual o preço?' } })).toBe('qual o preço?');
    expect(texto({ imageMessage: { caption: 'esse corte' } })).toBe('esse corte');
    expect(texto({ listResponseMessage: { title: 'Agendar' } })).toBe('Agendar');
    expect(texto({ audioMessage: { seconds: 3 } })).toBe('');
  });

  it('número escondido (@lid) usa o número alternativo', () => {
    const e = lerWebhookEvolution(
      mensagem({
        key: {
          remoteJid: '987654@lid',
          remoteJidAlt: '5511977776666@s.whatsapp.net',
          fromMe: false,
          id: 'X',
        },
      }),
    );
    expect(e).toMatchObject({ telefone: '5511977776666' });
  });

  it('ignora o que o próprio número mandou, grupo e mensagem sem id', () => {
    const k = (key: object) =>
      lerWebhookEvolution(mensagem({ key: { remoteJid: '5511988887777@s.whatsapp.net', ...key } }));
    expect(k({ fromMe: true, id: 'A' })).toBeNull();
    expect(k({ fromMe: false })).toBeNull();
    expect(
      lerWebhookEvolution(mensagem({ key: { remoteJid: '1203@g.us', fromMe: false, id: 'A' } })),
    ).toBeNull();
  });

  it('sem horário válido usa a hora de chegada', () => {
    const e = lerWebhookEvolution(mensagem({ messageTimestamp: undefined }), agora);
    expect(e).toMatchObject({ recebidaEm: agora.toISOString() });
  });

  it('mudança de conexão vira evento de estado', () => {
    expect(
      lerWebhookEvolution({
        event: 'connection.update',
        instance: 'pf-unidade',
        data: { state: 'open', wuid: '5511900001111@s.whatsapp.net' },
      }),
    ).toEqual({
      tipo: 'conexao',
      instancia: 'pf-unidade',
      status: 'conectado',
      numero: '5511900001111',
    });
    expect(
      lerWebhookEvolution({ event: 'connection.update', instance: 'x', data: { state: 'close' } }),
    ).toMatchObject({ status: 'desconectado', numero: null });
  });

  it('outros eventos e corpo estranho voltam null', () => {
    expect(lerWebhookEvolution({ event: 'qrcode.updated', instance: 'x', data: {} })).toBeNull();
    expect(lerWebhookEvolution('lixo')).toBeNull();
    expect(lerWebhookEvolution(null)).toBeNull();
  });

  it('instanciaDoWebhook só lê o nome', () => {
    expect(instanciaDoWebhook({ instance: 'pf-1', resto: 1 })).toBe('pf-1');
    expect(instanciaDoWebhook({})).toBeNull();
  });
});

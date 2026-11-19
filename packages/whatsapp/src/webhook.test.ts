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
      conteudo: 'texto',
      anuncio: null,
      recebidaEm: new Date(1_793_811_600_000).toISOString(),
    });
  });

  // Pedido do dono em 16/11/2026: identificar quem chegou por anúncio.
  it('mensagem de anúncio (clique para o WhatsApp) vem marcada com o título do anúncio', () => {
    const doAnuncio = mensagem({
      message: {
        extendedTextMessage: {
          text: 'Olá! Quero saber mais.',
          contextInfo: {
            externalAdReply: {
              title: 'Corte + barba por R$ 50',
              sourceType: 'ad',
              sourceId: '120',
            },
            conversionSource: 'FB_Ads',
          },
        },
      },
    });
    expect(lerWebhookEvolution(doAnuncio, agora)).toMatchObject({
      texto: 'Olá! Quero saber mais.',
      anuncio: { titulo: 'Corte + barba por R$ 50', origemId: '120' },
    });
    // Só a origem (sem o cartão do anúncio), no contextInfo do dado.
    expect(
      lerWebhookEvolution(mensagem({ contextInfo: { conversionSource: 'FB_Ads' } }), agora),
    ).toMatchObject({ anuncio: { titulo: null, origemId: null } });
    // 18/11/2026: cartão de link ou publicação compartilhada (com sourceId, sem "ad") e origens
    // comuns (link wa.me, Threads, busca) não são anúncio.
    const cartao = (externalAdReply: object, extra: object = {}) =>
      lerWebhookEvolution(
        mensagem({
          message: {
            extendedTextMessage: { text: 'oi', contextInfo: { externalAdReply, ...extra } },
          },
        }),
        agora,
      );
    expect(cartao({ title: 'Post', sourceType: 'post', sourceId: '99' })).toMatchObject({
      anuncio: null,
    });
    expect(cartao({ title: 'Link', sourceId: '99' })).toMatchObject({ anuncio: null });
    for (const origem of ['click_to_chat_link', 'threads', 'global_search_new_chat'])
      expect(
        lerWebhookEvolution(
          mensagem({ contextInfo: { entryPointConversionSource: origem } }),
          agora,
        ),
      ).toMatchObject({ anuncio: null });
    // O clique no anúncio (ctwaClid) e a origem ctwa contam.
    expect(cartao({ title: 'Anúncio', ctwaClid: 'abc' })).toMatchObject({
      anuncio: { titulo: 'Anúncio' },
    });
    expect(
      lerWebhookEvolution(
        mensagem({ contextInfo: { entryPointConversionSource: 'ctwa_ad' } }),
        agora,
      ),
    ).toMatchObject({ anuncio: { titulo: null } });
    // Resposta comum a outra mensagem: não é anúncio.
    expect(
      lerWebhookEvolution(
        mensagem({ contextInfo: { quotedMessage: { conversation: 'oi' } } }),
        agora,
      ),
    ).toMatchObject({ anuncio: null });
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

  it('o que o próprio número mandou vem como "propria"; grupo e sem id são ignorados', () => {
    const k = (key: object) =>
      lerWebhookEvolution(mensagem({ key: { remoteJid: '5511988887777@s.whatsapp.net', ...key } }));
    expect(k({ fromMe: true, id: 'A' })).toMatchObject({
      tipo: 'propria',
      idExterno: 'A',
      telefone: '5511988887777',
      texto: 'oi',
    });
    expect(k({ fromMe: false })).toBeNull();
    expect(
      lerWebhookEvolution(mensagem({ key: { remoteJid: '1203@g.us', fromMe: false, id: 'A' } })),
    ).toBeNull();
  });

  // Cenários de 19/11/2026: reação a uma mensagem, apagada ou editada não é conversa; áudio e
  // figurinha chegam marcados, sem texto.
  it('reação, mensagem apagada e editada são ignoradas; áudio e mídia vêm marcados', () => {
    const com = (message: object) => lerWebhookEvolution(mensagem({ message }), agora);
    expect(com({ reactionMessage: { text: '👍', key: { id: 'X' } } })).toBeNull();
    expect(com({ protocolMessage: { type: 'REVOKE' } })).toBeNull();
    expect(com({ editedMessage: { message: { conversation: 'corrigido' } } })).toBeNull();
    expect(com({ senderKeyDistributionMessage: {} })).toBeNull();
    expect(com({ audioMessage: { seconds: 5 } })).toMatchObject({ texto: '', conteudo: 'audio' });
    expect(com({ stickerMessage: {} })).toMatchObject({ texto: '', conteudo: 'midia' });
    expect(com({ imageMessage: { caption: 'meu cabelo' } })).toMatchObject({
      texto: 'meu cabelo',
      conteudo: 'texto',
    });
    // Mensagem temporária: o texto está dentro dela.
    expect(com({ ephemeralMessage: { message: { conversation: 'oi temporário' } } })).toMatchObject(
      {
        texto: 'oi temporário',
        conteudo: 'texto',
      },
    );
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

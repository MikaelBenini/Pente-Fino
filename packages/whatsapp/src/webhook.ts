import { telefoneDoJid, type EventoWhatsapp } from '@pente-fino/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { statusEvolution } from './evolution.js';

// ─── Assinatura ───────────────────────────────────────────────────────────

/** Assinatura da instância: a Evolution manda de volta em todo webhook, a API confere. */
export function assinarInstancia(segredo: string, instancia: string): string {
  return createHmac('sha256', segredo).update(`whatsapp:${instancia}`).digest('hex');
}

export function assinaturaValida(
  segredo: string,
  instancia: string,
  recebida: string | undefined | null,
): boolean {
  if (!recebida) return false;
  const esperada = Buffer.from(assinarInstancia(segredo, instancia));
  const veio = Buffer.from(recebida);
  return esperada.length === veio.length && timingSafeEqual(esperada, veio);
}

// ─── Leitura do webhook da Evolution ──────────────────────────────────────

const chave = z.object({
  remoteJid: z.string().optional(),
  /** Quando o WhatsApp esconde o número (@lid), o número de verdade vem aqui. */
  remoteJidAlt: z.string().optional(),
  senderPn: z.string().optional(),
  fromMe: z.boolean().optional(),
  id: z.string().optional(),
});

const mensagem = z
  .object({
    conversation: z.string().optional(),
    extendedTextMessage: z.object({ text: z.string().optional() }).loose().optional(),
    imageMessage: z.object({ caption: z.string().optional() }).loose().optional(),
    videoMessage: z.object({ caption: z.string().optional() }).loose().optional(),
    buttonsResponseMessage: z
      .object({ selectedDisplayText: z.string().optional() })
      .loose()
      .optional(),
    listResponseMessage: z.object({ title: z.string().optional() }).loose().optional(),
  })
  .loose();

const corpoMensagem = z.object({
  event: z.literal('messages.upsert'),
  instance: z.string().min(1),
  data: z
    .object({
      key: chave,
      pushName: z.string().nullable().optional(),
      message: mensagem.nullable().optional(),
      messageTimestamp: z.union([z.number(), z.string()]).optional(),
    })
    .loose(),
});

const corpoConexao = z.object({
  event: z.literal('connection.update'),
  instance: z.string().min(1),
  data: z
    .object({
      state: z.string().optional(),
      wuid: z.string().optional(),
    })
    .loose(),
});

/** Só o nome da instância, para conferir a assinatura antes de ler o resto. */
export function instanciaDoWebhook(corpo: unknown): string | null {
  const r = z.object({ instance: z.string().min(1).max(100) }).safeParse(corpo);
  return r.success ? r.data.instance : null;
}

type Solto = Record<string, unknown>;
const objeto = (v: unknown): Solto | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Solto) : null;
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

/**
 * Anúncio de clique para o WhatsApp (Facebook/Instagram): o WhatsApp manda no contextInfo da
 * primeira mensagem o externalAdReply (título, id do anúncio) e/ou conversionSource "FB_Ads".
 * A Evolution entrega o contextInfo no dado da mensagem ou dentro do texto estendido.
 */
export function anuncioDaMensagem(
  dado: unknown,
): { titulo: string | null; origemId: string | null } | null {
  const d = objeto(dado);
  if (!d) return null;
  const msg = objeto(d.message);
  const contextos = [
    objeto(d.contextInfo),
    objeto(objeto(msg?.extendedTextMessage)?.contextInfo),
    objeto(objeto(msg?.imageMessage)?.contextInfo),
    objeto(objeto(msg?.videoMessage)?.contextInfo),
    objeto(msg?.messageContextInfo),
  ].filter((c): c is Solto => !!c);
  for (const c of contextos) {
    const ad = objeto(c.externalAdReply);
    // Só o anúncio de verdade (18/11/2026): o cartão marcado como anúncio, o id do clique no
    // anúncio (ctwaClid) ou a origem FB_Ads/ctwa. Cartão de link, publicação compartilhada e
    // "sourceId" sozinho não contam: mandavam o fluxo do anúncio para quem não veio dele.
    const origem = (v: unknown) => (texto(v) ?? '').toLowerCase();
    const fontes = [origem(c.conversionSource), origem(c.entryPointConversionSource)];
    const deAnuncio =
      (ad && (origem(ad.sourceType) === 'ad' || !!texto(ad.ctwaClid))) ||
      fontes.some((f) => f === 'fb_ads' || f === 'ctwa_ad' || f.startsWith('ctwa'));
    if (deAnuncio)
      return { titulo: texto(ad?.title) ?? texto(ad?.body), origemId: texto(ad?.sourceId) };
  }
  return null;
}

/**
 * O que a mensagem é (cenários de 19/11/2026): texto, áudio, outra mídia (foto, figurinha,
 * documento, contato, localização) ou nada que o cliente tenha escrito (reação, mensagem apagada
 * ou editada, voto em enquete, aviso de chave), que o bot ignora.
 */
export type ConteudoMensagem = 'texto' | 'audio' | 'midia' | 'ignorar';

const CHAVES_DE_MIDIA = [
  'imageMessage',
  'videoMessage',
  'stickerMessage',
  'documentMessage',
  'documentWithCaptionMessage',
  'contactMessage',
  'contactsArrayMessage',
  'locationMessage',
  'liveLocationMessage',
  'ptvMessage',
];

/** Desembrulha as mensagens temporárias e de visualização única. */
function desembrulhar(m: Solto | null): Solto | null {
  let atual = m;
  for (let i = 0; i < 3 && atual; i++) {
    const dentro =
      objeto(objeto(atual.ephemeralMessage)?.message) ??
      objeto(objeto(atual.viewOnceMessage)?.message) ??
      objeto(objeto(atual.viewOnceMessageV2)?.message) ??
      objeto(objeto(atual.viewOnceMessageV2Extension)?.message);
    if (!dentro) break;
    atual = dentro;
  }
  return atual;
}

export function conteudoDa(message: unknown, texto: string): ConteudoMensagem {
  if (texto.trim()) return 'texto';
  const m = desembrulhar(objeto(message));
  if (!m) return 'ignorar';
  if (m.audioMessage) return 'audio';
  if (CHAVES_DE_MIDIA.some((k) => m[k])) return 'midia';
  // Reação, apagada/editada (protocolMessage, editedMessage), enquete, fixar, chave: não é
  // mensagem do cliente; responder "não entendi" a um 👍 é constrangedor.
  return 'ignorar';
}

function textoDa(m: z.infer<typeof mensagem> | null | undefined): string {
  if (!m) return '';
  // Temporária ou de visualização única: o texto está dentro.
  const d = desembrulhar(objeto(m)) as typeof m | null;
  if (d && d !== m) return textoDa(d);
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.buttonsResponseMessage?.selectedDisplayText ??
    m.listResponseMessage?.title ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    ''
  ).slice(0, 2000);
}

/**
 * Webhook da Evolution → evento do sistema. O que o bot não trata (grupo, status, QR atualizado,
 * outros eventos) volta null. O que saiu do próprio número vem como "propria".
 */
export function lerWebhookEvolution(corpo: unknown, agora = new Date()): EventoWhatsapp | null {
  const msg = corpoMensagem.safeParse(corpo);
  if (msg.success) {
    const { key, pushName, message, messageTimestamp } = msg.data.data;
    if (!key.id) return null;
    const telefone =
      telefoneDoJid(key.remoteJid) ??
      telefoneDoJid(key.remoteJidAlt) ??
      telefoneDoJid(key.senderPn);
    if (!telefone) return null;
    const segundos = Number(messageTimestamp);
    const texto = textoDa(message);
    // Reação, mensagem apagada ou editada, enquete: não é conversa (nem da equipe pelo celular).
    const conteudo = conteudoDa(message, texto);
    if (conteudo === 'ignorar') return null;
    // Saiu do próprio número: pode ser o bot (o eco) ou a equipe pelo celular; quem decide é o
    // banco, que sabe o que o bot mandou.
    if (key.fromMe)
      return {
        tipo: 'propria',
        instancia: msg.data.instance,
        idExterno: key.id,
        telefone,
        texto,
        recebidaEm: (Number.isFinite(segundos) && segundos > 0
          ? new Date(segundos * 1000)
          : agora
        ).toISOString(),
      };
    return {
      tipo: 'mensagem',
      instancia: msg.data.instance,
      idExterno: key.id,
      telefone,
      nome: pushName?.trim().slice(0, 80) || null,
      texto,
      conteudo,
      anuncio: anuncioDaMensagem(msg.data.data),
      recebidaEm: (Number.isFinite(segundos) && segundos > 0
        ? new Date(segundos * 1000)
        : agora
      ).toISOString(),
    };
  }
  const con = corpoConexao.safeParse(corpo);
  if (con.success) {
    return {
      tipo: 'conexao',
      instancia: con.data.instance,
      status: statusEvolution(con.data.data.state),
      numero: telefoneDoJid(con.data.data.wuid),
    };
  }
  return null;
}

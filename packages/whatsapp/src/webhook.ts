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

function textoDa(m: z.infer<typeof mensagem> | null | undefined): string {
  if (!m) return '';
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
 * Webhook da Evolution → evento do sistema. O que o bot não trata (mensagem enviada pelo
 * próprio número, grupo, status, QR atualizado, outros eventos) volta null.
 */
export function lerWebhookEvolution(corpo: unknown, agora = new Date()): EventoWhatsapp | null {
  const msg = corpoMensagem.safeParse(corpo);
  if (msg.success) {
    const { key, pushName, message, messageTimestamp } = msg.data.data;
    if (key.fromMe || !key.id) return null;
    const telefone =
      telefoneDoJid(key.remoteJid) ??
      telefoneDoJid(key.remoteJidAlt) ??
      telefoneDoJid(key.senderPn);
    if (!telefone) return null;
    const segundos = Number(messageTimestamp);
    return {
      tipo: 'mensagem',
      instancia: msg.data.instance,
      idExterno: key.id,
      telefone,
      nome: pushName?.trim().slice(0, 80) || null,
      texto: textoDa(message),
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

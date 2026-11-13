// Admin F6: chat do site com a equipe do Pente Fino. O visitante deixa nome e contato, escreve a
// dúvida e entra na fila; alguém da equipe assume, conversa e encerra. Fora do horário, a
// mensagem fica guardada e a equipe responde pelo contato. As mensagens chegam por consulta
// periódica (alguns segundos), sem conexão aberta.
import { z } from 'zod';

/** Horário de atendimento (Brasília): segunda a sexta das 9 h às 18 h, sábado das 9 h às 13 h. */
export const HORARIO_CHAT: Readonly<Record<number, readonly [number, number] | null>> = {
  0: null,
  1: [9, 18],
  2: [9, 18],
  3: [9, 18],
  4: [9, 18],
  5: [9, 18],
  6: [9, 13],
};
export const TEXTO_HORARIO_CHAT = 'Segunda a sexta, das 9h às 18h, e sábado, das 9h às 13h';

/** Dentro do horário de atendimento agora (fuso de São Paulo)? */
export function chatEmHorario(agora: Date): boolean {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value]),
  );
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday ?? '');
  const faixa = HORARIO_CHAT[dia];
  const hora = Number(partes.hour);
  return !!faixa && hora >= faixa[0] && hora < faixa[1];
}

const texto = z
  .string()
  .trim()
  .min(1, { error: 'Escreva a mensagem.' })
  .max(2000, { error: 'Mensagem muito longa (até 2000 caracteres).' });

/** O contato: WhatsApp (só dígitos, com DDD) ou e-mail. */
const contato = z
  .string()
  .trim()
  .min(5, { error: 'Deixe seu WhatsApp ou e-mail para a gente responder.' })
  .max(120)
  .refine((v) => /\S+@\S+\.\S+/.test(v) || v.replace(/\D/g, '').length >= 10, {
    error: 'Informe um WhatsApp com DDD ou um e-mail válido.',
  });

export const iniciarChatSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Diga seu nome.' }).max(80),
  contato,
  texto,
  /** Página onde a conversa começou (ex.: /planos). */
  pagina: z.string().trim().max(200).optional(),
});
export type IniciarChatEntrada = z.infer<typeof iniciarChatSchema>;

export const mensagemChatSchema = z.object({ texto });
export type MensagemChatEntrada = z.infer<typeof mensagemChatSchema>;

export type StatusChat = 'fila' | 'atendendo' | 'encerrada';

export interface MensagemChat {
  id: string;
  de: 'visitante' | 'equipe';
  /** Nome de quem da equipe escreveu (para o visitante, só o primeiro nome). */
  autor: string | null;
  texto: string;
  criadoEm: string;
}

/** O que o visitante recebe ao consultar a conversa. */
export interface ChatDoVisitante {
  status: StatusChat;
  /** Posição na fila (1 = é o próximo); null fora da fila. */
  posicao: number | null;
  /** Primeiro nome de quem está atendendo. */
  atendente: string | null;
  emHorario: boolean;
  mensagens: MensagemChat[];
}

export interface ChatIniciado {
  id: string;
  /** Segredo do visitante para ler e escrever nesta conversa (guardado só no navegador dele). */
  token: string;
}

/** Linha da lista da administração. */
export interface ConversaNaFila {
  id: string;
  status: StatusChat;
  nome: string;
  contato: string;
  pagina: string | null;
  atendente: string | null;
  criadoEm: string;
  ultimaMensagemEm: string;
  /** Texto da última mensagem (até 120 caracteres). */
  ultimaMensagem: string;
  /** A última mensagem é do visitante (esperando resposta). */
  esperandoEquipe: boolean;
}

/** Conversa aberta na administração. */
export interface ConversaDaEquipe extends ConversaNaFila {
  mensagens: MensagemChat[];
}

/** Aviso que o visitante vê junto da conversa. */
export function avisoDoChat(
  c: Pick<ChatDoVisitante, 'status' | 'posicao' | 'atendente' | 'emHorario'>,
): string {
  if (c.status === 'encerrada') return 'Conversa encerrada. Se precisar, comece outra.';
  if (c.status === 'atendendo' && c.atendente) return `${c.atendente} está te atendendo.`;
  if (!c.emHorario)
    return `Estamos fora do horário (${TEXTO_HORARIO_CHAT.toLowerCase()}). Sua mensagem ficou guardada e respondemos pelo seu contato assim que voltarmos.`;
  if (c.posicao && c.posicao > 1)
    return `Você está na fila: ${c.posicao - 1} ${c.posicao === 2 ? 'pessoa' : 'pessoas'} na sua frente. Já já alguém responde.`;
  return 'Você é o próximo da fila. Já já alguém responde.';
}

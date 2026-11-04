// Filas do BullMQ compartilhadas entre a API (produz) e o worker (consome).

export const FILA_EMAILS = 'emails';
export const FILA_EVENTOS = 'eventos';
/** Webhook do provedor de WhatsApp, já lido e conferido pela API. */
export const FILA_WHATSAPP_ENTRADA = 'whatsapp-entrada';
/** Mensagens para enviar, uma por trabalho, espaçadas por número da barbearia. */
export const FILA_WHATSAPP_SAIDA = 'whatsapp-saida';

export type StatusConexaoWhatsapp = 'desconectado' | 'aguardando_qr' | 'conectado';

/** O que chega do provedor, num formato que não depende dele. */
export type EventoWhatsapp =
  | {
      tipo: 'mensagem';
      instancia: string;
      /** Id da mensagem no WhatsApp: a mesma mensagem entregue duas vezes é descartada. */
      idExterno: string;
      telefone: string;
      /** Nome do perfil do WhatsApp, quando vem. */
      nome: string | null;
      /** Texto da mensagem; vazio para áudio, foto e figurinha. */
      texto: string;
      recebidaEm: string;
    }
  | {
      tipo: 'conexao';
      instancia: string;
      status: StatusConexaoWhatsapp;
      /** Número conectado (só dígitos), quando o provedor informa. */
      numero: string | null;
    };

/**
 * Mensagens escritas no painel (resposta da recepção, "devolver ao bot"): passam pela fila de
 * entrada para o worker espaçá-las junto com as do bot, no mesmo relógio por número.
 */
export interface EnvioDoPainel {
  tipo: 'enviar';
  contaId: string;
  instancia: string;
  mensagemIds: string[];
}

/** O que vai na fila `whatsapp-entrada`: eventos do provedor ou envios do painel. */
export type TrabalhoWhatsappEntrada = EventoWhatsapp | EnvioDoPainel;

/** Uma mensagem já gravada (tabela mensagem) esperando a vez de sair. */
export interface TrabalhoWhatsappSaida {
  contaId: string;
  mensagemId: string;
}

/** E-mail pronto para envio; o worker só entrega. */
export interface TrabalhoEmail {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

/** Eventos de domínio (docs/documentacao-do-produto.md, seção 5). */
export const EVENTOS = [
  'agendamento.criado',
  'comanda.confirmada',
  'comanda.fechada',
  'comanda.reaberta',
  'mensagem.recebida',
  'adesao.vencida',
  'usuario.convidado',
  'usuario.senha_alterada',
] as const;
export type NomeEvento = (typeof EVENTOS)[number];

/** Envelope de todo evento: a conta vai junto para o worker abrir naConta(). */
export interface EventoDominio<D = Record<string, unknown>> {
  nome: NomeEvento;
  contaId: string;
  ocorridoEm: string;
  dados: D;
}

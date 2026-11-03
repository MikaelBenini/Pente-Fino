// Filas do BullMQ compartilhadas entre a API (produz) e o worker (consome).

export const FILA_EMAILS = 'emails';
export const FILA_EVENTOS = 'eventos';

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

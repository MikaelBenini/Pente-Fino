// Estado da conversa no WhatsApp (testes de 19/11/2026): o que a tela Conversas mostra, de onde
// veio cada mudança, a trava contra loop e o horário em que mensagem automática pode sair.

/** Bot respondendo, aguardando atendente (bot pausado) ou em atendimento humano (bot pausado). */
export type SituacaoConversa = 'bot' | 'aguardando' | 'atendimento';

export const ROTULO_SITUACAO: Record<SituacaoConversa, string> = {
  bot: 'Bot respondendo',
  aguardando: 'Aguardando atendente · bot pausado',
  atendimento: 'Em atendimento humano · bot pausado',
};

/** A mesma regra do gatilho situacao_da_conversa() no banco. */
export function situacaoDaConversa(
  atendenteDesde: Date | string | null,
  comAtendente: boolean,
): SituacaoConversa {
  if (atendenteDesde) return 'aguardando';
  return comAtendente ? 'atendimento' : 'bot';
}

/** De onde veio a mudança de estado (gravada pelo gatilho com app.origem_conversa). */
export const ORIGENS_CONVERSA = {
  cliente_pediu: 'O cliente pediu atendente',
  anuncio: 'O fluxo do anúncio passou a conversa para a equipe',
  painel_assumiu: 'Assumiu pelo painel',
  painel_respondeu: 'Respondeu pelo painel',
  painel_enviou: 'Mandou mensagem pelo painel',
  painel_devolveu: 'Devolveu ao bot pelo painel',
  cliente_voltou: 'O cliente respondeu MENU e voltou ao bot antes de ser atendido',
  celular_respondeu: 'A equipe respondeu pelo WhatsApp do celular',
  trava_loop: 'Trava contra loop: mensagens demais em pouco tempo',
  espera_venceu: 'Ninguém respondeu em 2 horas: o bot voltou',
  atendimento_venceu: 'O cliente escreveu depois de 2 horas: o bot voltou',
  bot: 'Conversa com o bot',
  sistema: 'Sistema',
} as const;
export type OrigemConversa = keyof typeof ORIGENS_CONVERSA;

export function rotuloOrigem(origem: string): string {
  return (ORIGENS_CONVERSA as Record<string, string>)[origem] ?? origem;
}

/**
 * Enquanto ninguém da equipe assumiu (aguardando), o cliente volta ao bot sozinho com uma destas
 * palavras; a mensagem de transferência avisa. Em atendimento humano, o bot continua quieto.
 */
export const PALAVRAS_VOLTAR_AO_BOT = ['menu', 'voltar ao menu', 'inicio'] as const;

// ─── Trava contra loop ─────────────────────────────────────────────────────

/**
 * Trava contra loop (pedido do dono em 18/11/2026; refeita nos testes de 19/11). Antes: 30
 * respostas do bot em 10 minutos, contando as de antes da devolução. Um teste longo atingia o
 * limite e, logo depois de "Devolver ao bot", a conversa voltava em silêncio para a fila. Loop de
 * verdade (dois robôs) é rápido e dos dois lados: agora conta só depois que o bot voltou e exige
 * muitas mensagens do bot E do outro número na janela curta.
 */
export const JANELA_LOOP_MIN = 2;
export const LIMITE_LOOP_SAIDAS = 15;
export const LIMITE_LOOP_ENTRADAS = 12;

/** De quando contar: a janela curta, ou desde que o bot voltou, o que for mais recente. */
export function inicioDaJanelaDoLoop(agora: Date, botDesde: string | null | undefined): Date {
  const janela = agora.getTime() - JANELA_LOOP_MIN * 60_000;
  const desde = botDesde ? Date.parse(botDesde) : Number.NaN;
  return new Date(Number.isFinite(desde) ? Math.max(janela, desde) : janela);
}

export function pareceLoop(saidasDoBot: number, entradas: number): boolean {
  return saidasDoBot >= LIMITE_LOOP_SAIDAS && entradas >= LIMITE_LOOP_ENTRADAS;
}

// ─── Horário de envio ──────────────────────────────────────────────────────

/**
 * Mensagem automática que não é resposta (lembrete, pesquisa, aviso, fim da espera) não sai de
 * madrugada (pedido do dono em 20/11/2026: "mensagens saindo de madrugada, com conversa
 * encerrada"). Resposta a quem acabou de escrever sai na hora.
 */
export const SILENCIO_INICIO_H = 22;
export const SILENCIO_FIM_H = 7;
/** Escreveu há menos que isto: a mensagem do bot é resposta e sai mesmo à noite. */
export const RESPOSTA_ATE_MIN = 15;
/** Mensagem segurada que, na hora de sair, já tem mais que isto: perdeu o sentido e é descartada. */
export const VALIDADE_SEGURADA_H = 12;

// Brasil sem horário de verão: São Paulo é UTC−3 o ano todo (o mesmo usado no resto do sistema).
const OFFSET_SP_MS = 3 * 3_600_000;

function horaLocal(d: Date): number {
  const l = new Date(d.getTime() - OFFSET_SP_MS);
  return l.getUTCHours() + l.getUTCMinutes() / 60;
}

export function emHorarioDeSilencio(d: Date): boolean {
  const h = horaLocal(d);
  return h >= SILENCIO_INICIO_H || h < SILENCIO_FIM_H;
}

/**
 * O próximo momento em que o automático pode sair (o próprio `d` fora do silêncio). `abreAs`
 * permite começar mais tarde que o fim do silêncio (a pesquisa vai às 9h, não às 7h).
 */
export function proximoHorarioDeEnvio(d: Date, abreAs: number = SILENCIO_FIM_H): Date {
  if (!emHorarioDeSilencio(d)) return d;
  const l = new Date(d.getTime() - OFFSET_SP_MS);
  const dia = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  const somar = l.getUTCHours() >= SILENCIO_INICIO_H ? 1 : 0;
  return new Date(dia + somar * 86_400_000 + abreAs * 3_600_000 + OFFSET_SP_MS);
}

/**
 * Lembrete que cairia no silêncio sai antes, no último minuto permitido da noite anterior (o de
 * 2 h de um horário às 8h sairia às 6h: sai às 21h59 da véspera). Se esse momento já passou ou é
 * antes de marcar, não manda (null).
 */
export function antecipadoParaForaDoSilencio(quando: Date, naoAntesDe: Date): Date | null {
  if (!emHorarioDeSilencio(quando)) return quando;
  const l = new Date(quando.getTime() - OFFSET_SP_MS);
  const dia = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  const voltar = l.getUTCHours() < SILENCIO_FIM_H ? 1 : 0;
  const limite = new Date(
    dia - voltar * 86_400_000 + SILENCIO_INICIO_H * 3_600_000 - 60_000 + OFFSET_SP_MS,
  );
  return limite > naoAntesDe ? limite : null;
}

// Proteção dos números de WhatsApp (pedido do dono em 27/11/2026: "use verificações para evitar
// restringir números"). A conexão é por QR Code (Evolution API), não a API oficial: o WhatsApp
// restringe o número que manda muita mensagem sem resposta, rápido demais, repetida ou para quem
// não quer receber. Estas regras valem para a mensagem AUTOMÁTICA (sem autor da equipe); a
// resposta a quem acabou de escrever e a mensagem digitada pela equipe saem como sempre.
// Aplicadas em prepararEnvio (packages/db) e no worker (ritmo e "digitando...").

import type { AvisoNovo } from './avisos.js';

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;

/**
 * Proativa = automática para quem não escreveu nas últimas 24 horas (lembrete, retorno,
 * aniversário, pesquisa, aviso). É o tipo de mensagem que conta para o risco de restrição.
 */
export const JANELA_CONVERSA_H = 24;

export function ehProativa(ultimaEntradaMs: number | null, agoraMs: number): boolean {
  return ultimaEntradaMs === null || agoraMs - ultimaEntradaMs > JANELA_CONVERSA_H * HORA_MS;
}

/**
 * Aquecimento: número recém-conectado manda poucas proativas por dia, e o limite cresce com o
 * tempo de uso. Número com mais de duas semanas: até 200 por dia.
 */
export const AQUECIMENTO_PROATIVAS: readonly { ateDia: number; limite: number }[] = [
  { ateDia: 2, limite: 20 },
  { ateDia: 6, limite: 50 },
  { ateDia: 13, limite: 100 },
];
export const LIMITE_PROATIVAS_DIA = 200;

/** Quantas proativas o número pode mandar hoje, pelos dias desde que foi conectado. */
export function limiteProativasDoDia(conectadoEm: Date | null, agora: Date): number {
  if (!conectadoEm) return AQUECIMENTO_PROATIVAS[0]!.limite;
  const dias = Math.floor((agora.getTime() - conectadoEm.getTime()) / DIA_MS);
  return AQUECIMENTO_PROATIVAS.find((a) => dias <= a.ateDia)?.limite ?? LIMITE_PROATIVAS_DIA;
}

/** Último dia do aquecimento (o limite cheio vale a partir do dia seguinte); null = aquecido. */
export function fimDoAquecimento(conectadoEm: Date | null, agora: Date): Date | null {
  if (!conectadoEm) return null;
  const ultimo = AQUECIMENTO_PROATIVAS.at(-1)!.ateDia;
  const fim = new Date(conectadoEm.getTime() + (ultimo + 1) * DIA_MS);
  return fim > agora ? fim : null;
}

/** Ritmo humano entre duas proativas do mesmo número: 25 s mais até 20 s ao acaso. */
export const INTERVALO_PROATIVA_MS = 25_000;
export const VARIACAO_PROATIVA_MS = 20_000;

/** Quando a próxima proativa do número pode sair (`aleatorio` entre 0 e 1). */
export function proximaProativa(
  ultimaMs: number | null,
  agoraMs: number,
  aleatorio: number,
): number {
  if (ultimaMs === null || agoraMs - ultimaMs >= INTERVALO_PROATIVA_MS + VARIACAO_PROATIVA_MS)
    return agoraMs;
  const variacao = Math.round(Math.min(Math.max(aleatorio, 0), 1) * VARIACAO_PROATIVA_MS);
  return Math.max(agoraMs, ultimaMs + INTERVALO_PROATIVA_MS + variacao);
}

/** "Digitando..." antes de enviar: 1 s mais 35 ms por letra, entre 1,2 s e 6 s. */
export function tempoDigitandoMs(texto: string): number {
  return Math.min(6_000, Math.max(1_200, 1_000 + texto.length * 35));
}

/** O mesmo texto para o mesmo número dentro desta janela é descartado (loop, clique duplo). */
export const JANELA_REPETIDA_MIN = 10;

/** Sinais de risco: o que pausa as proativas do número, e por quanto tempo. */
export const FALHAS_PARA_PAUSAR = 5;
export const JANELA_FALHAS_MIN = 30;
export const PAUSA_FALHAS_H = 6;
export const SAIDAS_PARA_PAUSAR = 5;
/** SAIR acima desta fração das proativas do dia também pausa (com o mínimo acima). */
export const FRACAO_SAIDAS_PARA_PAUSAR = 0.03;
export const PAUSA_SAIDAS_H = 24;

export type MotivoPausa = 'falhas' | 'saidas';

export const TEXTO_MOTIVO_PAUSA: Readonly<Record<MotivoPausa, string>> = {
  falhas: 'os envios estão falhando seguidos',
  saidas: 'muitos clientes responderam SAIR hoje',
};

/**
 * Pausa as proativas quando aparece sinal de que o WhatsApp pode restringir o número: falhas de
 * envio seguidas (o número pode estar sendo limitado) ou muita gente pedindo para parar (vira
 * denúncia). Devolve até quando e o motivo, ou null.
 */
export function pausaPorRisco(
  d: { falhasRecentes: number; saidas24h: number; proativas24h: number },
  agora: Date,
): { ate: Date; motivo: MotivoPausa } | null {
  if (d.falhasRecentes >= FALHAS_PARA_PAUSAR)
    return { ate: new Date(agora.getTime() + PAUSA_FALHAS_H * HORA_MS), motivo: 'falhas' };
  if (
    d.saidas24h >= SAIDAS_PARA_PAUSAR &&
    d.saidas24h >= Math.ceil(d.proativas24h * FRACAO_SAIDAS_PARA_PAUSAR)
  )
    return { ate: new Date(agora.getTime() + PAUSA_SAIDAS_H * HORA_MS), motivo: 'saidas' };
  return null;
}

/** Aviso ao dono e ao gestor quando as automáticas do número pausam (uma vez por pausa). */
export function avisoNumeroProtegido(d: {
  unidadeId: string;
  unidade: string;
  motivo: MotivoPausa;
  ate: Date;
}): AvisoNovo {
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d.ate);
  return {
    tipo: 'whatsapp_protegido',
    titulo: `Mensagens automáticas pausadas · ${d.unidade}`,
    texto: `Para o WhatsApp não restringir o número, as mensagens automáticas (lembretes, retorno, aniversário) param até ${hora}: ${TEXTO_MOTIVO_PAUSA[d.motivo]}. O bot continua respondendo quem escreve.`,
    link: '/bot',
    chave: `protegido:${d.unidadeId}:${d.ate.toISOString()}`,
  };
}

/**
 * Prioridade no limite do dia (sugestão aprovada em 27/11/2026): retorno, aniversário, aviso do
 * clube e pesquisa usam só parte do limite; o resto fica guardado para o que tem hora marcada
 * (lembrete do horário, vaga da lista de espera, horário mudado), que nunca fica para depois por
 * causa de mensagem que podia esperar.
 */
export const AUTOMACOES_QUE_PODEM_ESPERAR: readonly string[] = [
  'retorno',
  'aniversario',
  'clube',
  'pesquisa',
];
export const FRACAO_PARA_O_QUE_PODE_ESPERAR = 0.7;

/** Quantas proativas do dia esta mensagem pode encontrar já enviadas e ainda sair. */
export function limiteDaMensagem(limiteDoDia: number, automacao: string | null): number {
  return automacao && AUTOMACOES_QUE_PODEM_ESPERAR.includes(automacao)
    ? Math.floor(limiteDoDia * FRACAO_PARA_O_QUE_PODE_ESPERAR)
    : limiteDoDia;
}

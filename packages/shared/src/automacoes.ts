// Automações do pós-atendimento (Etapa 12): convite de retorno e mensagem de aniversário,
// pelo WhatsApp da barbearia, uma vez por rotina diária. Regras puras; o banco escolhe e grava.
import { z } from 'zod';

export interface AutomacoesConta {
  /** Convite para quem passou do intervalo habitual de visitas. */
  retorno: boolean;
  /** Intervalo usado para quem ainda não tem histórico (2 visitas ou mais). */
  retornoDiasPadrao: number;
  aniversario: boolean;
}

/** Começam desligadas: o dono escolhe ligar (mensagem que o cliente não pediu). */
export const AUTOMACOES_PADRAO: Readonly<AutomacoesConta> = {
  retorno: false,
  retornoDiasPadrao: 30,
  aniversario: false,
};

export const automacoesSchema = z.object({
  retorno: z.boolean(),
  retornoDiasPadrao: z.number().int().min(14, { error: 'Pelo menos 14 dias.' }).max(120),
  aniversario: z.boolean(),
});

export function lerAutomacoes(valor: unknown): AutomacoesConta {
  const r = automacoesSchema.partial().safeParse(valor ?? {});
  return { ...AUTOMACOES_PADRAO, ...(r.success ? r.data : {}) };
}

/** Mensagens por número da unidade, por dia, somando as automações (protege o número). */
export const LIMITE_AUTOMACOES_DIA = 20;
/** Hora da rotina diária (São Paulo). */
export const HORA_DAS_AUTOMACOES = 10;

const DIA_MS = 86_400_000;

/**
 * Intervalo habitual entre visitas (dias): a mediana das últimas idas (até 6), entre 14 e 120.
 * Com menos de 2 visitas, o padrão da conta.
 */
export function intervaloHabitual(visitas: readonly Date[], padrao: number): number {
  const ordenadas = [...visitas].sort((a, b) => b.getTime() - a.getTime()).slice(0, 6);
  if (ordenadas.length < 2) return padrao;
  const intervalos = ordenadas
    .slice(1)
    .map((v, i) => (ordenadas[i]!.getTime() - v.getTime()) / DIA_MS)
    .sort((a, b) => a - b);
  const meio = Math.floor(intervalos.length / 2);
  const mediana =
    intervalos.length % 2 ? intervalos[meio]! : (intervalos[meio - 1]! + intervalos[meio]!) / 2;
  return Math.min(120, Math.max(14, Math.round(mediana)));
}

/**
 * Convite de retorno: passou do intervalo habitual desde a última visita, sem horário marcado
 * e sem convite desde essa visita (um por ciclo).
 */
export function deveConvidarRetorno(d: {
  ultimaVisita: Date;
  intervaloDias: number;
  convidadoEm: Date | null;
  temHorarioMarcado: boolean;
  agora: Date;
}): boolean {
  if (d.temHorarioMarcado) return false;
  if (d.convidadoEm && d.convidadoEm >= d.ultimaVisita) return false;
  return d.agora.getTime() - d.ultimaVisita.getTime() >= d.intervaloDias * DIA_MS;
}

/** Hoje (AAAA-MM-DD) é o aniversário? 29/02 comemora em 28/02 nos anos sem 29. */
export function ehAniversario(nascimento: string, hoje: string): boolean {
  const md = nascimento.slice(5, 10);
  const hojeMd = hoje.slice(5, 10);
  if (md === hojeMd) return true;
  const ano = Number(hoje.slice(0, 4));
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  return md === '02-29' && !bissexto && hojeMd === '02-28';
}

// ─── Números de cada automação ────────────────────────────────────────────

export const AUTOMACOES = ['retorno', 'aniversario', 'pesquisa', 'lembrete'] as const;
export type Automacao = (typeof AUTOMACOES)[number];

export const NOME_AUTOMACAO: Readonly<Record<Automacao, string>> = {
  retorno: 'Convite de retorno',
  aniversario: 'Aniversário',
  pesquisa: 'Pesquisa depois do atendimento',
  lembrete: 'Lembrete do horário',
};

/** Respondida = o cliente escreveu até 48 h depois; agendou = horário criado até 7 dias depois. */
export const RESPOSTA_ATE_H = 48;
export const AGENDOU_ATE_DIAS = 7;

export interface NumerosAutomacao {
  automacao: Automacao;
  enviadas: number;
  respondidas: number;
  agendamentos: number;
}

export interface EstadoAutomacoes {
  config: AutomacoesConta;
  numeros: NumerosAutomacao[];
}

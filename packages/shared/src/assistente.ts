// Assistente da equipe no WhatsApp (Etapa 11): o profissional pergunta a agenda e a comissão
// pelo número da barbearia e recebe os avisos da agenda dele. Sem IA: palavras fixas.
import { z } from 'zod';
import { formatarHora, formatarMoeda } from './formatacao.js';

export const AVISOS_EQUIPE = ['horarioNovo', 'mudancas'] as const;
export type AvisoEquipe = (typeof AVISOS_EQUIPE)[number];
export type AvisosEquipe = Record<AvisoEquipe, boolean>;

export const NOME_AVISO_EQUIPE: Readonly<Record<AvisoEquipe, string>> = {
  horarioNovo: 'Horário novo na minha agenda',
  mudancas: 'Horário remarcado ou cancelado',
};

export const AVISOS_EQUIPE_PADRAO: Readonly<AvisosEquipe> = { horarioNovo: true, mudancas: true };

export function lerAvisosEquipe(valor: unknown): AvisosEquipe {
  const v = (valor && typeof valor === 'object' ? valor : {}) as Partial<Record<string, unknown>>;
  return Object.fromEntries(
    AVISOS_EQUIPE.map((k) => [k, typeof v[k] === 'boolean' ? v[k] : AVISOS_EQUIPE_PADRAO[k]]),
  ) as AvisosEquipe;
}

/** O código vale este tempo depois de gerado no Perfil. */
export const CODIGO_ASSISTENTE_VALIDADE_MIN = 30;
/** Mensagens do assistente por dia, por profissional (avisos, não respostas). */
export const LIMITE_AVISOS_EQUIPE_DIA = 30;
/** Folga antes do primeiro e depois do último turno em que os avisos ainda saem. */
const FOLGA_ANTES_MIN = 60;
const FOLGA_DEPOIS_MIN = 30;

export type ComandoEquipe =
  | { tipo: 'ativar'; codigo: string }
  | { tipo: 'agenda' | 'amanha' | 'comissao' | 'parar' | 'ligar' | 'ajuda' };

const sem = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** O que o profissional pediu; null quando não é comando (aí ele recebe a ajuda). */
export function lerComandoEquipe(entrada: string): ComandoEquipe | null {
  const t = sem(entrada);
  const ativar = /^ativar (\d{6})$/.exec(t);
  if (ativar) return { tipo: 'ativar', codigo: ativar[1]! };
  if (/^(agenda|hoje|agenda de hoje|minha agenda)$/.test(t)) return { tipo: 'agenda' };
  if (/^(amanha|agenda de amanha)$/.test(t)) return { tipo: 'amanha' };
  if (/^(comissao|minha comissao|comissoes)$/.test(t)) return { tipo: 'comissao' };
  if (/^(parar|pare|sair|desligar)$/.test(t)) return { tipo: 'parar' };
  if (/^(ligar|voltar|religar)$/.test(t)) return { tipo: 'ligar' };
  if (/^(ajuda|menu|oi|ola|comandos)$/.test(t)) return { tipo: 'ajuda' };
  return null;
}

/**
 * Avisos só saem perto do expediente do dia (uma hora antes do primeiro turno até meia hora
 * depois do último); sem expediente no dia, nada sai. Turnos em minutos desde 00:00 (São Paulo).
 */
export function podeAvisarAgora(
  turnosDoDia: readonly { inicioMin: number; fimMin: number }[],
  minutoAgora: number,
): boolean {
  if (turnosDoDia.length === 0) return false;
  const inicio = Math.min(...turnosDoDia.map((t) => t.inicioMin)) - FOLGA_ANTES_MIN;
  const fim = Math.max(...turnosDoDia.map((t) => t.fimMin)) + FOLGA_DEPOIS_MIN;
  return minutoAgora >= inicio && minutoAgora <= fim;
}

export interface HorarioDaAgenda {
  inicio: string;
  /** Primeiro nome do cliente (nunca telefone). */
  cliente: string;
  servicos: readonly string[];
  confirmado: boolean;
}

export const TEXTO_AJUDA_EQUIPE = [
  'Assistente da equipe. Responda:',
  '',
  'AGENDA · seus horários de hoje',
  'AMANHÃ · seus horários de amanhã',
  'COMISSÃO · sua comissão do mês',
  'PARAR · para de mandar avisos',
].join('\n');

export function textoAgendaEquipe(rotulo: string, horarios: readonly HorarioDaAgenda[]): string {
  if (horarios.length === 0) return `${rotulo}: nenhum horário marcado.`;
  return [
    `${rotulo}: ${horarios.length} ${horarios.length === 1 ? 'horário' : 'horários'}`,
    '',
    ...horarios.map(
      (h) =>
        `${formatarHora(h.inicio)} · ${h.cliente} · ${h.servicos.join(' + ')}${h.confirmado ? ' ✓' : ''}`,
    ),
  ].join('\n');
}

export function textoComissaoEquipe(mes: string, fechada: number, atendimentos: number): string {
  return [
    `Comissão de ${mes}:`,
    '',
    `✅ ${formatarMoeda(fechada)} em ${atendimentos} ${atendimentos === 1 ? 'atendimento fechado' : 'atendimentos fechados'}`,
    '',
    'Horários ainda abertos entram quando a recepção fecha a comanda.',
  ].join('\n');
}

export type MudancaNaAgenda = 'novo' | 'remarcado' | 'cancelado';

export function textoAvisoEquipe(
  tipo: MudancaNaAgenda,
  h: { quando: string; cliente: string; servicos: readonly string[] },
): string {
  const linha = `${h.quando} · ${h.cliente} · ${h.servicos.join(' + ')}`;
  if (tipo === 'novo') return `📅 Horário novo na sua agenda:\n${linha}`;
  if (tipo === 'remarcado') return `🔁 Horário remarcado:\n${linha}`;
  return `❌ Horário cancelado:\n${linha}`;
}

// ─── Perfil: ligar e configurar ───────────────────────────────────────────

export interface EstadoAssistente {
  /** desligado: nunca ligou ou desligou; aguardando: gerou o código e falta mandar; ligado;
   *  pausado: respondeu PARAR (ainda pergunta, não recebe aviso). */
  situacao: 'desligado' | 'aguardando' | 'ligado' | 'pausado';
  unidade: string;
  /** Número do WhatsApp da unidade (para onde mandar o código); null sem conexão. */
  numeroBarbearia: string | null;
  whatsappConectado: boolean;
  /** Número confirmado do profissional. */
  telefone: string | null;
  avisos: AvisosEquipe;
  codigoExpiraEm: string | null;
}

export interface CodigoAssistente {
  codigo: string;
  expiraEm: string;
  /** wa.me com "ATIVAR 123456" pronto, quando a unidade tem número conectado. */
  link: string | null;
}

export const avisosEquipeSchema = z.object({
  horarioNovo: z.boolean(),
  mudancas: z.boolean(),
});

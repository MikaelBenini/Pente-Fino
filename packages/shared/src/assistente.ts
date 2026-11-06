// Assistente da equipe no WhatsApp (Etapa 11): o profissional pergunta a agenda e a comissão
// pelo número da barbearia e recebe os avisos da agenda dele. Sem IA: palavras fixas.
import { z } from 'zod';
import { formatarHora, formatarMoeda } from './formatacao.js';

export const AVISOS_EQUIPE = [
  'horarioNovo',
  'mudancas',
  'proximoCliente',
  'agendaDoDia',
  'resumoDoDia',
  // Gestão (dono e gestor):
  'faltas',
  'notaBaixa',
  'resumoGestao',
] as const;
export type AvisoEquipe = (typeof AVISOS_EQUIPE)[number];
export type AvisosEquipe = Record<AvisoEquipe, boolean>;

export const NOME_AVISO_EQUIPE: Readonly<Record<AvisoEquipe, string>> = {
  horarioNovo: 'Horário novo na minha agenda',
  mudancas: 'Horário remarcado ou cancelado',
  proximoCliente: 'Próximo cliente, 15 minutos antes',
  agendaDoDia: 'Agenda do dia, antes de começar',
  resumoDoDia: 'Resumo do dia, no fim do expediente',
  faltas: 'Cliente que faltou',
  notaBaixa: 'Nota 1 ou 2 na pesquisa',
  resumoGestao: 'Resumo da unidade, no fim do dia',
};

/** Avisos de quem atende (está na agenda). */
export const AVISOS_PROFISSIONAL: readonly AvisoEquipe[] = [
  'horarioNovo',
  'mudancas',
  'proximoCliente',
  'agendaDoDia',
  'resumoDoDia',
];
/** Avisos de dono e gestor. */
export const AVISOS_GESTAO: readonly AvisoEquipe[] = ['faltas', 'notaBaixa', 'resumoGestao'];

/** Quais avisos a pessoa pode escolher: os da agenda se atende, os de gestão se é dono/gestor. */
export function avisosDisponiveis(d: { profissional: boolean; gestao: boolean }): AvisoEquipe[] {
  return [...(d.profissional ? AVISOS_PROFISSIONAL : []), ...(d.gestao ? AVISOS_GESTAO : [])];
}

/** Nota que vira aviso para dono e gestor. */
export const NOTA_BAIXA_ATE = 2;
/** Sem o fim da pesquisa (cliente parou de responder), o aviso de nota baixa sai depois disto. */
export const NOTA_BAIXA_ESPERA_MIN = 15;

export const AVISOS_EQUIPE_PADRAO: Readonly<AvisosEquipe> = {
  horarioNovo: true,
  mudancas: true,
  proximoCliente: true,
  agendaDoDia: true,
  resumoDoDia: true,
  faltas: true,
  notaBaixa: true,
  resumoGestao: true,
};

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
  | { tipo: 'agenda' | 'amanha' | 'comissao' | 'resumo' | 'parar' | 'ligar' | 'ajuda' };

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
  if (/^(resumo|resumo do dia|resumo de hoje|caixa)$/.test(t)) return { tipo: 'resumo' };
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

/** Ajuda conforme quem é: quem atende, quem gere ou os dois. */
export function textoAjudaEquipe(d: { profissional: boolean; gestao: boolean }): string {
  if (d.profissional && !d.gestao) return TEXTO_AJUDA_EQUIPE;
  return [
    'Assistente da equipe. Responda:',
    '',
    ...(d.profissional
      ? [
          'AGENDA · seus horários de hoje',
          'AMANHÃ · seus horários de amanhã',
          'COMISSÃO · sua comissão do mês',
        ]
      : []),
    'RESUMO · como está o dia nas unidades',
    'PARAR · para de mandar avisos',
  ].join('\n');
}

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

// ─── Gestão: falta, nota baixa e resumo da unidade ────────────────────────

export function textoFaltaGestao(f: {
  unidade: string;
  cliente: string;
  profissional: string;
  inicio: string;
}): string {
  return `🚫 Falta · ${f.unidade}\n${f.cliente} não veio às ${formatarHora(f.inicio)} com ${f.profissional}.`;
}

export function textoNotaBaixa(n: {
  unidade: string;
  profissional: string;
  cliente: string;
  notaAtendimento: number | null;
  notaBarbearia: number | null;
  comentario: string | null;
  /** wa.me do cliente, para o dono falar com ele; null quando não há número. */
  link: string | null;
}): string {
  const notas = [
    n.notaAtendimento !== null ? `atendimento ${n.notaAtendimento}` : null,
    n.notaBarbearia !== null ? `barbearia ${n.notaBarbearia}` : null,
  ].filter(Boolean);
  return [
    `⚠️ Nota baixa · ${n.unidade}`,
    `${n.cliente}, atendido por ${n.profissional}: ${notas.join(', ')}`,
    ...(n.comentario ? [`"${n.comentario}"`] : []),
    ...(n.link ? ['', `Falar com o cliente: ${n.link}`] : []),
  ].join('\n');
}

export interface ResumoUnidade {
  unidade: string;
  /** Total líquido das comandas fechadas hoje. */
  faturamento: number;
  /** Comandas fechadas com ao menos um serviço. */
  clientes: number;
  faltas: number;
  notasBaixas: number;
  /** Comandas atendidas esperando a recepção fechar (em atendimento, confirmada, pendente, reaberta). */
  abertas: number;
  /** Ritmo do mês: faturamento até hoje e a projeção pelos dias de trabalho da unidade. */
  mes?: { faturamento: number; projecao: number };
}

export function textoResumoGestao(rotulo: string, unidades: readonly ResumoUnidade[]): string {
  const bloco = (u: ResumoUnidade) => [
    ...(unidades.length > 1 ? [`🏠 ${u.unidade}`] : []),
    `💰 ${formatarMoeda(u.faturamento)} em ${u.clientes} ${u.clientes === 1 ? 'cliente' : 'clientes'}${u.clientes > 0 ? ` · ticket ${formatarMoeda(Math.round(u.faturamento / u.clientes))}` : ''}`,
    ...(u.mes
      ? [`📈 Mês: ${formatarMoeda(u.mes.faturamento)} · projeção ${formatarMoeda(u.mes.projecao)}`]
      : []),
    ...(u.faltas > 0 ? [`🚫 ${u.faltas} ${u.faltas === 1 ? 'falta' : 'faltas'}`] : []),
    ...(u.notasBaixas > 0
      ? [`⚠️ ${u.notasBaixas} ${u.notasBaixas === 1 ? 'nota baixa' : 'notas baixas'}`]
      : []),
    ...(u.abertas > 0
      ? [
          `⏳ ${u.abertas} ${u.abertas === 1 ? 'comanda esperando fechamento' : 'comandas esperando fechamento'}`,
        ]
      : []),
  ];
  return [
    `${rotulo}${unidades.length === 1 ? ` · ${unidades[0]!.unidade}` : ''}`,
    '',
    ...unidades.flatMap((u, i) => [...(i > 0 ? [''] : []), ...bloco(u)]),
  ].join('\n');
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
  /** Os avisos que esta pessoa pode escolher (agenda, gestão ou os dois). */
  disponiveis: AvisoEquipe[];
  codigoExpiraEm: string | null;
}

export interface CodigoAssistente {
  codigo: string;
  expiraEm: string;
  /** wa.me com "ATIVAR 123456" pronto, quando a unidade tem número conectado. */
  link: string | null;
}

/** Só os avisos que mudam; os que faltam ficam como estão (app antigo manda menos chaves). */
export const avisosEquipeSchema = z
  .object({
    horarioNovo: z.boolean(),
    mudancas: z.boolean(),
    proximoCliente: z.boolean(),
    agendaDoDia: z.boolean(),
    resumoDoDia: z.boolean(),
    faltas: z.boolean(),
    notaBaixa: z.boolean(),
    resumoGestao: z.boolean(),
  })
  .partial();

// ─── Avisos com hora marcada ──────────────────────────────────────────────

/** "Próximo cliente": minutos antes do horário. */
export const PROXIMO_CLIENTE_MIN = 15;
/** Agenda do dia: minutos antes do primeiro turno; resumo: minutos depois do último. */
export const AGENDA_DO_DIA_ANTES_MIN = 60;
export const RESUMO_DO_DIA_DEPOIS_MIN = 15;

/** Quando avisar "próximo cliente"; null se o horário foi marcado em cima da hora ou já passou. */
export function momentoProximoCliente(inicio: Date, marcadoEm: Date, agora: Date): Date | null {
  const quando = new Date(inicio.getTime() - PROXIMO_CLIENTE_MIN * 60_000);
  return quando > agora && quando > marcadoEm ? quando : null;
}

export type RotinaEquipe = 'agenda' | 'resumo' | 'gestao';

/**
 * Próxima agenda do dia (1 h antes do primeiro turno) ou resumo (15 min depois do último), a
 * partir de `depoisDe`, procurando até 14 dias à frente (folga e dia sem turno pulam).
 * Turnos por dia da semana (0 = domingo), em minutos; o instante sai em -03:00.
 */
export function proximaRotina(
  turnos: readonly { diaSemana: number; inicioMin: number; fimMin: number }[],
  rotina: RotinaEquipe,
  depoisDe: Date,
): { dia: string; quando: Date } | null {
  const hoje = new Date(depoisDe.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
  for (let i = 0; i < 14; i++) {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const dia = d.toISOString().slice(0, 10);
    const doDia = turnos.filter((t) => t.diaSemana === d.getUTCDay());
    if (doDia.length === 0) continue;
    const minuto =
      rotina === 'agenda'
        ? Math.min(...doDia.map((t) => t.inicioMin)) - AGENDA_DO_DIA_ANTES_MIN
        : Math.max(...doDia.map((t) => t.fimMin)) + RESUMO_DO_DIA_DEPOIS_MIN;
    const hh = String(Math.floor(minuto / 60)).padStart(2, '0');
    const mm = String(minuto % 60).padStart(2, '0');
    const quando = new Date(`${dia}T${hh}:${mm}:00-03:00`);
    if (quando > depoisDe) return { dia, quando };
  }
  return null;
}

export function textoProximoCliente(h: {
  inicio: string;
  cliente: string;
  servicos: readonly string[];
  primeiraVez: boolean;
}): string {
  return `⏰ Próximo cliente às ${formatarHora(h.inicio)}: ${h.cliente}${h.primeiraVez ? ' (primeira vez)' : ''} · ${h.servicos.join(' + ')}`;
}

export function textoResumoDoDia(r: {
  atendidos: number;
  comissao: number;
  faltas: number;
  amanha: number;
}): string {
  return [
    'Resumo de hoje:',
    '',
    `✂️ ${r.atendidos} ${r.atendidos === 1 ? 'atendimento fechado' : 'atendimentos fechados'}`,
    `💰 Comissão do dia: ${formatarMoeda(r.comissao)}`,
    ...(r.faltas > 0 ? [`🚫 ${r.faltas} ${r.faltas === 1 ? 'falta' : 'faltas'}`] : []),
    '',
    r.amanha > 0
      ? `Amanhã: ${r.amanha} ${r.amanha === 1 ? 'horário marcado' : 'horários marcados'}. Bom descanso!`
      : 'Amanhã: nenhum horário marcado por enquanto. Bom descanso!',
  ].join('\n');
}

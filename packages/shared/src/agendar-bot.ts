// Agendamento pela conversa do WhatsApp (Etapa 11): serviço → profissional → dia → horário →
// confirmação. Aqui só o que é puro (ler a resposta, montar as listas e o resumo); quem
// consulta a agenda e grava é packages/db/src/agendar-bot.ts.
import { formatarHora, formatarMoeda } from './formatacao.js';

/** Até quantos dias à frente o cliente marca sozinho (bot e site). */
export const JANELA_AGENDAMENTO_DIAS = 45;
/** Horários futuros por cliente na unidade: acima disso, só com a recepção. */
export const MAX_FUTUROS_POR_CLIENTE = 2;
/** Quantos dias com horário livre o bot mostra de uma vez. */
export const DIAS_POR_VEZ = 6;
/** Quantos horários por página ("7. Ver mais horários"). */
export const HORARIOS_POR_VEZ = 6;

/** Até quanto tempo antes o cliente remarca ou cancela sozinho; depois, com a recepção. */
export const PRAZO_MUDAR_MIN = 120;

export type PassoAgenda =
  | 'servico'
  | 'profissional'
  | 'dia'
  | 'horario'
  | 'confirmar'
  // "Meus horários": escolher qual, o que fazer e confirmar o cancelamento.
  | 'meus'
  | 'acao'
  | 'cancelar';

/** Estado do agendamento guardado na sessão do número. */
export interface AgendaNaConversa {
  passo: PassoAgenda;
  servicoIds: string[];
  /** null = sem preferência (o primeiro livre em cada horário). */
  profissionalId: string | null;
  dia: string | null;
  /** O que cada número da última lista quer dizer (ids, dias ou "inicio|profissional"). */
  opcoes: string[];
  /** Página da lista de horários. */
  pagina: number;
  /** Escolha final, para o resumo e a gravação. */
  escolha: { inicio: string; profissionalId: string } | null;
  /** Respostas seguidas que não serviram neste passo. */
  erros: number;
  /** Remarcando este agendamento (null = marcando um novo). */
  remarcarId: string | null;
}

export const agendaNova = (): AgendaNaConversa => ({
  passo: 'servico',
  servicoIds: [],
  profissionalId: null,
  dia: null,
  opcoes: [],
  pagina: 0,
  escolha: null,
  erros: 0,
  remarcarId: null,
});

const POR_EXTENSO: Readonly<Record<string, number>> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
};

/**
 * Números da resposta: "2", "1 e 3", "1, 3", "1 3", "opção 2", "dois". Vazio quando não há
 * número (ou há palavra que não é número, como "quero o 2 amanhã").
 */
export function lerNumeros(entrada: string): number[] {
  const t = entrada
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:opcao|opcoes|op|numero|numeros|n)\s+/, '');
  if (!t) return [];
  const numeros: number[] = [];
  for (const p of t.split(' ')) {
    if (p === 'e') continue;
    if (/^\d{1,2}$/.test(p)) numeros.push(Number(p));
    else if (p in POR_EXTENSO) numeros.push(POR_EXTENSO[p]!);
    else return [];
  }
  return [...new Set(numeros)];
}

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "Hoje (qua, 05/11)", "Amanhã (qui, 06/11)", "Sexta, 07/11". */
export function rotuloDoDia(dia: string, hoje: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const ddmm = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const semana = SEMANA[d.getUTCDay()]!;
  const curto = semana.slice(0, 3);
  const amanha = new Date(`${hoje}T12:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  if (dia === hoje) return `Hoje (${curto}, ${ddmm})`;
  if (dia === amanha.toISOString().slice(0, 10)) return `Amanhã (${curto}, ${ddmm})`;
  return `${semana[0]!.toUpperCase()}${semana.slice(1)}, ${ddmm}`;
}

const lista = (itens: readonly string[], primeiro = 1) =>
  itens.map((t, i) => `${i + primeiro}. ${t}`).join('\n');

export interface ServicoParaAgendar {
  id: string;
  nome: string;
  preco: number;
  duracaoMin: number;
}

export function textoServicos(
  servicos: readonly ServicoParaAgendar[],
  link: string | null,
): string {
  const linhas = servicos.map((s) => `${s.nome} · ${formatarMoeda(s.preco)} · ${s.duracaoMin} min`);
  return [
    'Qual serviço você quer? Responda o número. Para mais de um, separe: 1 e 3.',
    '',
    lista(linhas),
    '0. Voltar ao menu',
    ...(link ? ['', `Prefere marcar pelo site? ${link}`] : []),
  ].join('\n');
}

export function textoProfissionais(nomes: readonly string[]): string {
  return [
    'Com quem você quer ser atendido?',
    '',
    lista(nomes),
    '0. Sem preferência (o primeiro livre)',
  ].join('\n');
}

export function textoDias(rotulos: readonly string[]): string {
  return ['Qual dia fica melhor?', '', lista(rotulos), '0. Voltar ao menu'].join('\n');
}

export function textoHorarios(
  diaRotulo: string,
  inicios: readonly string[],
  temMais: boolean,
): string {
  return [
    `Horários livres ${diaRotulo.startsWith('Hoje') || diaRotulo.startsWith('Amanhã') ? diaRotulo.toLowerCase() : `na ${diaRotulo.toLowerCase()}`}:`,
    '',
    lista(inicios.map((i) => formatarHora(i))),
    ...(temMais ? [`${inicios.length + 1}. Ver mais horários`] : []),
    '0. Outro dia',
  ].join('\n');
}

export interface ResumoAgendamento {
  servicos: readonly string[];
  profissional: string;
  diaRotulo: string;
  inicio: string;
  total: number;
}

const quando = (r: ResumoAgendamento) => `${r.diaRotulo}, às ${formatarHora(r.inicio)}`;

export function textoConfirmar(r: ResumoAgendamento): string {
  return [
    'Confere se está certo:',
    '',
    `✂️ ${r.servicos.join(' + ')}`,
    `💈 Com ${r.profissional}`,
    `📅 ${quando(r)}`,
    `💰 ${formatarMoeda(r.total)}`,
    '',
    '1. Confirmar',
    '2. Escolher outro horário',
    '0. Cancelar',
  ].join('\n');
}

export function textoMarcado(r: ResumoAgendamento, barbearia: string): string {
  return [
    'Pronto, horário marcado! ✅',
    '',
    `✂️ ${r.servicos.join(' + ')}`,
    `💈 Com ${r.profissional}`,
    `📅 ${quando(r)}`,
    '',
    `Te esperamos na ${barbearia}. Precisa mudar? Responda ATENDENTE.`,
  ].join('\n');
}

// ─── Meus horários ────────────────────────────────────────────────────────

export interface HorarioDoCliente {
  inicio: string;
  servicos: readonly string[];
  profissional: string;
}

const linhaDoHorario = (h: HorarioDoCliente, hoje: string) =>
  `${rotuloDoDia(diaLocal(h.inicio), hoje)}, às ${formatarHora(h.inicio)} · ${h.servicos.join(' + ')} com ${h.profissional}`;

/** Dia em São Paulo (AAAA-MM-DD) de um instante ISO, sem depender de Intl (-03:00 fixo). */
function diaLocal(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function textoMeusHorarios(horarios: readonly HorarioDoCliente[], hoje: string): string {
  return [
    'Seus horários marcados:',
    '',
    lista(horarios.map((h) => linhaDoHorario(h, hoje))),
    '',
    'Responda o número para remarcar ou cancelar, ou 0 para voltar ao menu.',
  ].join('\n');
}

export function textoAcoesDoHorario(h: HorarioDoCliente, hoje: string): string {
  return [
    `📅 ${linhaDoHorario(h, hoje)}`,
    '',
    '1. Remarcar',
    '2. Cancelar',
    '0. Voltar ao menu',
  ].join('\n');
}

export function textoConfirmarCancelamento(h: HorarioDoCliente, hoje: string): string {
  return [
    `Cancelar o horário de ${linhaDoHorario(h, hoje)}?`,
    '',
    '1. Sim, cancelar',
    '2. Não, manter',
  ].join('\n');
}

export function textoRemarcado(r: ResumoAgendamento, barbearia: string): string {
  return [
    'Pronto, horário remarcado! ✅',
    '',
    `✂️ ${r.servicos.join(' + ')}`,
    `💈 Com ${r.profissional}`,
    `📅 ${quando(r)}`,
    '',
    `Te esperamos na ${barbearia}.`,
  ].join('\n');
}

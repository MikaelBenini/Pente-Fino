// Agendamento pela conversa do WhatsApp (Etapa 11): serviço → profissional → dia → horário →
// confirmação. Aqui só o que é puro (ler a resposta, montar as listas e o resumo); quem
// consulta a agenda e grava é packages/db/src/agendar-bot.ts.
import { textoTolerancia } from './atraso.js';
import { formatarHora, formatarMoeda } from './formatacao.js';

/** Quantos dias com horário livre o bot mostra de uma vez. */
export const DIAS_POR_VEZ = 6;
/** Quantos horários por página ("7. Ver mais horários"). */
export const HORARIOS_POR_VEZ = 6;

/** Passos do agendamento pela conversa (a lista também valida a sessão do simulador do painel). */
export const PASSOS_AGENDA = [
  // Por onde marcar: conversa ou site (some quando a unidade não tem site ou o cliente já escolheu a conversa).
  'canal',
  'servico',
  // Depois do serviço: "quer adicionar mais algum?" (0 segue para o horário).
  'mais_servico',
  'profissional',
  'dia',
  'horario',
  'confirmar',
  // "Meus horários": escolher qual, o que fazer e confirmar o cancelamento.
  'meus',
  'acao',
  'cancelar',
  // Depois de marcar: "quer que eu avise se vagar antes?" (Etapa 14).
  'antecipar',
  // Depois de marcar, para quem ainda não tem: o dia do aniversário (pedido do dono em 13/11).
  'aniversario',
  // Remarcação rápida depois do "Não veio" por atraso: o número já marca (Etapa 14).
  'atraso',
] as const;
export type PassoAgenda = (typeof PASSOS_AGENDA)[number];

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
  /** A lista de horários tem a opção "Ver mais" (o "me avise" vem depois dela). */
  temMais?: boolean;
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

/** Canal de agendamento guardado no cliente: o último que ele usou. */
export type CanalAgendamento = 'conversa' | 'site';

/** Texto que o "Prefere pelo WhatsApp?" do site manda pronto: o bot vai direto para a conversa. */
export const TEXTO_AGENDAR_POR_AQUI = 'AGENDAR POR AQUI';

export function textoEscolherCanal(): string {
  return [
    'Como você prefere marcar?',
    '',
    '1. Por aqui, na conversa',
    '2. Pelo site (seu nome e telefone já vão preenchidos)',
    '0. Voltar ao menu',
  ].join('\n');
}

export function textoLinkDoSite(link: string): string {
  return [
    `Marque pelo site, com seu nome e telefone já preenchidos:`,
    link,
    '',
    'O link vale por 2 dias. Prefere marcar por aqui na conversa? Responda 1.',
  ].join('\n');
}

export function textoServicos(
  servicos: readonly ServicoParaAgendar[],
  link: string | null,
): string {
  const linhas = servicos.map((s) => `${s.nome} · ${formatarMoeda(s.preco)} · ${s.duracaoMin} min`);
  return [
    'Qual serviço você quer? Responda o número. Depois dá para adicionar outro.',
    '',
    lista(linhas),
    '0. Voltar ao menu',
    ...(link ? ['', `Prefere marcar pelo site? ${link}`] : []),
    '',
    DICA_VOLTAR_MENU,
  ].join('\n');
}

/** Depois de escolher: o que já está anotado e os outros serviços para somar (0 segue). */
export function textoMaisServico(
  escolhidos: readonly ServicoParaAgendar[],
  restantes: readonly ServicoParaAgendar[],
): string {
  const preco = escolhidos.reduce((t, s) => t + s.preco, 0);
  const min = escolhidos.reduce((t, s) => t + s.duracaoMin, 0);
  const linhas = restantes.map(
    (s) => `${s.nome} · ${formatarMoeda(s.preco)} · ${s.duracaoMin} min`,
  );
  return [
    `✅ Anotado: ${escolhidos.map((s) => s.nome).join(' + ')} · ${formatarMoeda(preco)} · ${min} min`,
    '',
    'Quer adicionar mais algum serviço? Responda o número.',
    '',
    lista(linhas),
    '0. Não, escolher o horário',
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
  /** Oferece entrar na lista de espera do dia ("nenhum serve"). */
  avisar = false,
): string {
  return [
    `Horários livres ${diaRotulo.startsWith('Hoje') || diaRotulo.startsWith('Amanhã') ? diaRotulo.toLowerCase() : `na ${diaRotulo.toLowerCase()}`}:`,
    '',
    lista(inicios.map((i) => formatarHora(i))),
    ...(temMais ? [`${inicios.length + 1}. Ver mais horários`] : []),
    ...(avisar
      ? [`${inicios.length + (temMais ? 2 : 1)}. Nenhum serve: me avise se vagar neste dia`]
      : []),
    '0. Outro dia',
  ].join('\n');
}

export interface ResumoAgendamento {
  servicos: readonly string[];
  profissional: string;
  diaRotulo: string;
  inicio: string;
  total: number;
  /** A unidade tem mais de um profissional: dá para trocar mantendo o serviço. */
  trocarProfissional?: boolean;
}

/** Dica dos comandos que valem em qualquer passo (lista do dono em 16/11/2026). */
export const DICA_VOLTAR_MENU = 'Escreva VOLTAR para o passo anterior ou MENU para o início.';

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
    ...(r.trocarProfissional ? ['3. Trocar o profissional'] : []),
    '0. Cancelar',
  ].join('\n');
}

/** Link do horário (ver, remarcar, cancelar) no fim da confirmação, quando há. */
const comoMudar = (link: string | null | undefined, semLink: string) =>
  link ? `Precisa mudar? Remarque ou cancele por aqui: ${link}` : semLink;

export function textoMarcado(
  r: ResumoAgendamento,
  barbearia: string,
  link?: string | null,
  /** Atraso tolerado (minutos) da unidade, avisado na confirmação. */
  toleranciaMin = 0,
): string {
  const tolerancia = textoTolerancia(toleranciaMin);
  return [
    'Pronto, horário marcado! ✅',
    '',
    `✂️ ${r.servicos.join(' + ')}`,
    `💈 Com ${r.profissional}`,
    `📅 ${quando(r)}`,
    ...(tolerancia ? [tolerancia] : []),
    '',
    `Te esperamos na ${barbearia}.`,
    comoMudar(link, 'Precisa mudar? Responda MEUS HORÁRIOS.'),
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

export function textoRemarcado(
  r: ResumoAgendamento,
  barbearia: string,
  link?: string | null,
  toleranciaMin = 0,
): string {
  const tolerancia = textoTolerancia(toleranciaMin);
  return [
    'Pronto, horário remarcado! ✅',
    '',
    `✂️ ${r.servicos.join(' + ')}`,
    `💈 Com ${r.profissional}`,
    `📅 ${quando(r)}`,
    ...(tolerancia ? [tolerancia] : []),
    '',
    `Te esperamos na ${barbearia}.`,
    ...(link ? [comoMudar(link, '')] : []),
  ].join('\n');
}

// ─── Aniversário pela conversa (pedido do dono em 13/11) ────────────────────

/** A pergunta, para quem marcou e ainda não tem o aniversário na ficha. */
export const TEXTO_PERGUNTA_ANIVERSARIO =
  'Quer receber um parabéns no seu aniversário? 🎂 Responda o dia e o mês (ex.: 15/03), ou 0 para pular.';

/**
 * "15/03", "15-3", "15 03" ou "15/03/1990" → "2000-03-15" (o ano não importa para o parabéns;
 * 2000 aceita o 29/02). null = não entendeu.
 */
export function lerAniversario(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})(?:\s*[/.\- ]\s*\d{2,4})?$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1) return null;
  const ultimo = new Date(Date.UTC(2000, mes, 0)).getUTCDate();
  if (dia > ultimo) return null;
  return `2000-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * "sim", "ok", "confirmo" valem 1; "não", "cancela" valem 0 (cenários de 19/11/2026: quem
 * respondia "sim" à confirmação ou ao lembrete recebia "não entendi"). `texto` já normalizado.
 */
export function respostaSimNao(texto: string): 1 | 0 | null {
  if (
    /^(?:sim|s|ss|sim sim|confirmo|confirmado|confirmar|confirma|ok|okay|pode ser|pode|isso|claro|fechado|beleza|blz|bora|perfeito|vou sim|estarei|estarei la)$/.test(
      texto,
    )
  )
    return 1;
  if (/^(?:nao|n|cancela|cancelar|desisto|nao vou|nao posso)$/.test(texto)) return 0;
  return null;
}

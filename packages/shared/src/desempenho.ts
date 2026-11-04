// Ficha do profissional (linha de desenvolvimento, Etapa 9). Regras puras: a API junta
// os dados, aqui só se calcula. Tudo sai de comandas FECHADAS, como os indicadores.
import { diaDaSemana, instanteLocal } from './agenda.js';
import { TOLERANCIA_PENDENTE_MIN } from './comanda.js';
import type { DataISO } from './vigencia.js';
import type { ItemFechado } from './indicadores.js';

const DIA_MS = 86_400_000;
const MIN_MS = 60_000;

/** Dias de calendário entre duas datas AAAA-MM-DD (b − a). */
export function diasEntreDatas(a: DataISO, b: DataISO): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DIA_MS);
}

// ─── Clientes ─────────────────────────────────────────────────────────────

/** Janela padrão do retorno: cliente que volta ao mesmo profissional em até 45 dias. */
export const JANELA_RETORNO_DIAS = 45;
/** Cliente com uma visita só é "sumido" depois disto; com histórico, 1,5× o intervalo dele. */
const FOLGA_SUMIDO = 1.5;
/** Mais antigo que isso já não é "sumido": é cliente perdido e sai da lista. */
const LIMITE_SUMIDO_DIAS = 365;

/** Uma comanda fechada do profissional com cliente identificado (data em São Paulo). */
export interface VisitaCliente {
  clienteId: string;
  data: DataISO;
}

export type SituacaoCliente = 'novo' | 'voltou_no_prazo' | 'voltou_depois';

export interface ClienteDoProfissional {
  clienteId: string;
  /** Dias com atendimento até o fim do período (duas comandas no mesmo dia = uma visita). */
  visitas: number;
  visitasNoPeriodo: number;
  primeiraVisita: DataISO;
  ultimaVisita: DataISO;
  /** Média de dias entre uma visita e a seguinte; null com uma visita só. */
  intervaloHabitualDias: number | null;
  /** Como chegou no período: primeira vez, voltou dentro da janela ou voltou depois dela. */
  situacao: SituacaoCliente;
}

export interface ClienteSumido {
  clienteId: string;
  visitas: number;
  ultimaVisita: DataISO;
  diasSemVir: number;
  /** Dias a partir dos quais ele já passou do costume. */
  limiteDias: number;
}

export interface ResumoClientes {
  atendidos: number;
  novos: number;
  voltaramNoPrazo: number;
  voltaramDepois: number;
  /** Voltaram no prazo ÷ atendidos (fração). */
  taxaRetorno: number;
  /** Média do intervalo habitual de quem tem duas visitas ou mais; null sem histórico. */
  intervaloMedioDias: number | null;
}

export interface AnaliseClientes {
  resumo: ResumoClientes;
  /** Atendidos no período, quem veio mais primeiro. */
  clientes: ClienteDoProfissional[];
  /** Passaram do costume de voltar (até hoje), quem mais vinha primeiro. */
  sumidos: ClienteSumido[];
}

function intervaloMedio(datas: readonly DataISO[]): number | null {
  if (datas.length < 2) return null;
  return Math.round(diasEntreDatas(datas[0]!, datas[datas.length - 1]!) / (datas.length - 1));
}

/**
 * Clientes de um profissional. `visitas` traz o histórico dele (pode ir além do período);
 * o período decide quem foi atendido e `hoje` decide quem sumiu.
 */
export function analisarClientes(
  visitas: readonly VisitaCliente[],
  periodo: { de: DataISO; ate: DataISO; hoje: DataISO },
  janelaRetornoDias = JANELA_RETORNO_DIAS,
): AnaliseClientes {
  const porCliente = new Map<string, Set<DataISO>>();
  for (const v of visitas) {
    if (!porCliente.has(v.clienteId)) porCliente.set(v.clienteId, new Set());
    porCliente.get(v.clienteId)!.add(v.data);
  }

  const clientes: ClienteDoProfissional[] = [];
  const sumidos: ClienteSumido[] = [];
  for (const [clienteId, conjunto] of porCliente) {
    const todas = [...conjunto].sort();
    const ateHoje = todas.filter((d) => d <= periodo.hoje);
    const ultimaHoje = ateHoje[ateHoje.length - 1];
    if (ultimaHoje) {
      const habitual = intervaloMedio(ateHoje);
      const limiteDias = habitual
        ? Math.max(Math.round(habitual * FOLGA_SUMIDO), 14)
        : janelaRetornoDias;
      const diasSemVir = diasEntreDatas(ultimaHoje, periodo.hoje);
      if (diasSemVir > limiteDias && diasSemVir <= LIMITE_SUMIDO_DIAS)
        sumidos.push({
          clienteId,
          visitas: ateHoje.length,
          ultimaVisita: ultimaHoje,
          diasSemVir,
          limiteDias,
        });
    }

    const ateFim = todas.filter((d) => d <= periodo.ate);
    const noPeriodo = ateFim.filter((d) => d >= periodo.de);
    if (noPeriodo.length === 0) continue;
    const primeiraNoPeriodo = noPeriodo[0]!;
    const anterior = ateFim.filter((d) => d < primeiraNoPeriodo).pop();
    const situacao: SituacaoCliente = !anterior
      ? 'novo'
      : diasEntreDatas(anterior, primeiraNoPeriodo) <= janelaRetornoDias
        ? 'voltou_no_prazo'
        : 'voltou_depois';
    clientes.push({
      clienteId,
      visitas: ateFim.length,
      visitasNoPeriodo: noPeriodo.length,
      primeiraVisita: ateFim[0]!,
      ultimaVisita: ateFim[ateFim.length - 1]!,
      intervaloHabitualDias: intervaloMedio(ateFim),
      situacao,
    });
  }

  clientes.sort((a, b) => b.visitasNoPeriodo - a.visitasNoPeriodo || b.visitas - a.visitas);
  sumidos.sort((a, b) => b.visitas - a.visitas || a.diasSemVir - b.diasSemVir);
  const conta = (s: SituacaoCliente) => clientes.filter((c) => c.situacao === s).length;
  const intervalos = clientes
    .map((c) => c.intervaloHabitualDias)
    .filter((x): x is number => x !== null);
  const voltaramNoPrazo = conta('voltou_no_prazo');
  return {
    resumo: {
      atendidos: clientes.length,
      novos: conta('novo'),
      voltaramNoPrazo,
      voltaramDepois: conta('voltou_depois'),
      taxaRetorno: clientes.length ? voltaramNoPrazo / clientes.length : 0,
      intervaloMedioDias: intervalos.length
        ? Math.round(intervalos.reduce((s, x) => s + x, 0) / intervalos.length)
        : null,
    },
    clientes,
    sumidos,
  };
}

// ─── Rotina: confirmação, atrasos e tempo de atendimento ──────────────────

/** Começar até 10 minutos depois do horário marcado não conta como atraso. */
export const TOLERANCIA_ATRASO_MIN = 10;
/** Tempo de atendimento fora disso é esquecimento de apertar o botão, não medida. */
const DURACAO_VALIDA = { min: 3, max: 240 };

export interface ComandaRotina {
  /** Horário marcado; null para quem chegou sem agendamento. */
  inicioAgendado: Date | null;
  fimAgendado: Date | null;
  iniciadaEm: Date | null;
  confirmadaEm: Date | null;
  /** O próprio profissional confirmou (o fechamento preenche `confirmadaEm` mesmo sem isso). */
  confirmadaPeloProfissional: boolean;
}

export interface ResumoRotina {
  comandas: number;
  /** Fechadas que o barbeiro confirmou (as demais a recepção fechou sem confirmação). */
  confirmadasPeloBarbeiro: number;
  percentualConfirmadas: number;
  /** Confirmadas antes de virar pendente (fim do horário + 15 min). */
  confirmadasNoPrazo: number;
  percentualNoPrazo: number;
  /** Minutos, em média, entre o fim do horário marcado e a confirmação (0 = confirmou antes). */
  minutosAteConfirmar: number | null;
  /** Começou depois do horário marcado + tolerância. */
  atrasos: number;
  atrasoMedioMin: number | null;
}

/** Minutos entre começar e confirmar; null quando não dá para medir. */
export function duracaoReal(c: Pick<ComandaRotina, 'iniciadaEm' | 'confirmadaEm'>): number | null {
  if (!c.iniciadaEm || !c.confirmadaEm) return null;
  const min = Math.round((c.confirmadaEm.getTime() - c.iniciadaEm.getTime()) / MIN_MS);
  return min >= DURACAO_VALIDA.min && min <= DURACAO_VALIDA.max ? min : null;
}

const media = (xs: readonly number[]) =>
  xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;

export function analisarRotina(comandas: readonly ComandaRotina[]): ResumoRotina {
  let confirmadas = 0;
  let noPrazo = 0;
  const ateConfirmar: number[] = [];
  const atrasos: number[] = [];
  for (const c of comandas) {
    if (c.confirmadaEm && c.confirmadaPeloProfissional) {
      confirmadas++;
      if (!c.fimAgendado) noPrazo++;
      else {
        const depois = (c.confirmadaEm.getTime() - c.fimAgendado.getTime()) / MIN_MS;
        if (depois <= TOLERANCIA_PENDENTE_MIN) noPrazo++;
        ateConfirmar.push(Math.max(0, Math.round(depois)));
      }
    }
    if (c.inicioAgendado && c.iniciadaEm) {
      const atraso = Math.round((c.iniciadaEm.getTime() - c.inicioAgendado.getTime()) / MIN_MS);
      if (atraso > TOLERANCIA_ATRASO_MIN) atrasos.push(atraso);
    }
  }
  const n = comandas.length;
  return {
    comandas: n,
    confirmadasPeloBarbeiro: confirmadas,
    percentualConfirmadas: n ? confirmadas / n : 0,
    confirmadasNoPrazo: noPrazo,
    percentualNoPrazo: n ? noPrazo / n : 0,
    minutosAteConfirmar: media(ateConfirmar),
    atrasos: atrasos.length,
    atrasoMedioMin: media(atrasos),
  };
}

// ─── Serviços e produtos ──────────────────────────────────────────────────

export interface ItemDesempenho extends ItemFechado {
  produtoId?: string | null;
}

export interface ComandaDesempenho {
  itens: readonly ItemDesempenho[];
  /** `duracaoReal` da comanda. */
  duracaoRealMin: number | null;
}

export interface ServicoDesempenho {
  servicoId: string;
  quantidade: number;
  /** Quantas dessas vezes o serviço entrou como extra. */
  comoExtra: number;
  receita: number;
  comissao: number;
  custo: number;
  /** Receita − (custo de produto + comissão). */
  lucro: number;
  /** Média medida em comandas com um serviço só (dá para atribuir o tempo). */
  tempoRealMedioMin: number | null;
  medicoes: number;
}

export interface ProdutoDesempenho {
  produtoId: string;
  quantidade: number;
  receita: number;
}

const liquido = (i: ItemFechado) => i.quantidade * i.precoUnitario - i.desconto;

/** Serviços feitos, do que mais rende para o que menos rende. */
export function desempenhoPorServico(comandas: readonly ComandaDesempenho[]): ServicoDesempenho[] {
  const mapa = new Map<string, ServicoDesempenho & { tempos: number[] }>();
  for (const c of comandas) {
    const servicos = c.itens.filter((i) => i.tipo === 'servico' && i.servicoId);
    const unico =
      servicos.length === 1 && servicos[0]!.quantidade === 1 ? servicos[0]!.servicoId : null;
    for (const i of servicos) {
      const id = i.servicoId!;
      const s = mapa.get(id) ?? {
        servicoId: id,
        quantidade: 0,
        comoExtra: 0,
        receita: 0,
        comissao: 0,
        custo: 0,
        lucro: 0,
        tempoRealMedioMin: null,
        medicoes: 0,
        tempos: [],
      };
      s.quantidade += i.quantidade;
      if (i.ehExtra) s.comoExtra += i.quantidade;
      s.receita += liquido(i);
      s.comissao += i.comissaoValor;
      s.custo += i.custoUnitario * i.quantidade;
      if (unico === id && c.duracaoRealMin !== null) s.tempos.push(c.duracaoRealMin);
      mapa.set(id, s);
    }
  }
  return [...mapa.values()]
    .map(({ tempos, ...s }) => ({
      ...s,
      lucro: s.receita - s.custo - s.comissao,
      tempoRealMedioMin: media(tempos),
      medicoes: tempos.length,
    }))
    .sort((a, b) => b.receita - a.receita);
}

export function produtosVendidos(comandas: readonly ComandaDesempenho[]): ProdutoDesempenho[] {
  const mapa = new Map<string, ProdutoDesempenho>();
  for (const c of comandas)
    for (const i of c.itens) {
      if (i.tipo !== 'produto' || !i.produtoId) continue;
      const p = mapa.get(i.produtoId) ?? { produtoId: i.produtoId, quantidade: 0, receita: 0 };
      p.quantidade += i.quantidade;
      p.receita += liquido(i);
      mapa.set(i.produtoId, p);
    }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || b.receita - a.receita);
}

// ─── Ocupação da agenda ───────────────────────────────────────────────────

export interface TurnoSemanal {
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  inicioMin: number;
  fimMin: number;
}

export interface Periodo {
  inicio: Date;
  fim: Date;
}

export interface Ocupacao {
  disponivelMin: number;
  agendadoMin: number;
  /** Agendado ÷ disponível (fração, no máximo 1). */
  fracao: number;
}

function sobreposicao(a: Periodo, b: Periodo): number {
  return Math.max(
    0,
    Math.min(a.fim.getTime(), b.fim.getTime()) - Math.max(a.inicio.getTime(), b.inicio.getTime()),
  );
}

/** Junta intervalos que se cruzam, para não descontar o mesmo minuto duas vezes. */
function unir(lista: readonly Periodo[]): Periodo[] {
  const ordenada = [...lista].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const saida: Periodo[] = [];
  for (const p of ordenada) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && p.inicio <= ultimo.fim) {
      if (p.fim > ultimo.fim) ultimo.fim = p.fim;
    } else saida.push({ inicio: p.inicio, fim: p.fim });
  }
  return saida;
}

/**
 * Ocupação = minutos agendados ÷ minutos de expediente (turnos dos dias trabalhados,
 * menos bloqueios como almoço e folga).
 */
export function calcularOcupacao(entrada: {
  dias: readonly DataISO[];
  turnos: readonly TurnoSemanal[];
  bloqueios: readonly Periodo[];
  agendados: readonly Periodo[];
}): Ocupacao {
  const expediente: Periodo[] = [];
  for (const dia of entrada.dias) {
    const semana = diaDaSemana(dia);
    for (const t of entrada.turnos)
      if (t.diaSemana === semana)
        expediente.push({
          inicio: instanteLocal(dia, t.inicioMin),
          fim: instanteLocal(dia, t.fimMin),
        });
  }
  const turnos = unir(expediente);
  const bloqueios = unir(entrada.bloqueios);
  const agendados = unir(entrada.agendados);
  let disponivel = 0;
  let agendado = 0;
  for (const t of turnos) {
    const duracao = t.fim.getTime() - t.inicio.getTime();
    const bloqueado = bloqueios.reduce((s, b) => s + sobreposicao(t, b), 0);
    disponivel += Math.max(0, duracao - bloqueado);
    agendado += agendados.reduce((s, a) => s + sobreposicao(t, a), 0);
  }
  const disponivelMin = Math.round(disponivel / MIN_MS);
  const agendadoMin = Math.min(Math.round(agendado / MIN_MS), disponivelMin);
  return { disponivelMin, agendadoMin, fracao: disponivelMin ? agendadoMin / disponivelMin : 0 };
}

// ─── Períodos ─────────────────────────────────────────────────────────────

/** Os `n` meses que terminam em `mes` (AAAA-MM), do mais antigo para o atual. */
export function mesesAte(mes: string, n: number): string[] {
  const [ano, m] = mes.split('-').map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ano, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

// ─── Respostas da API ─────────────────────────────────────────────────────

export interface ResumoDesempenho {
  faturamento: number;
  receitaServicos: number;
  receitaProdutos: number;
  atendimentos: number;
  clientes: number;
  ticketMedio: number;
  extrasQuantidade: number;
  percentualExtras: number;
  /** Comissão dos itens das comandas fechadas no período. */
  comissao: number;
}

/** Uma linha do ranking da equipe (tela Equipe). */
export interface LinhaRankingEquipe extends ResumoDesempenho {
  profissionalId: string;
  nome: string;
  unidadeId: string;
  ativo: boolean;
  taxaRetorno: number;
  percentualNoPrazo: number;
  ocupacao: number;
  notaMedia: number | null;
}

export interface FichaProfissional {
  profissional: {
    id: string;
    nome: string;
    unidadeId: string;
    unidade: string;
    dataEntrada: DataISO;
    ativo: boolean;
  };
  periodo: { de: DataISO; ate: DataISO };
  /** Link público de agendamento da unidade, quando ligado (vai na mensagem de retorno). */
  linkAgendamento: string | null;
  /** Dono vê custo e lucro dos serviços; gestor e barbeiro não. */
  verMargem: boolean;
  resumo: ResumoDesempenho;
  comissao: { previsto: number; fechado: number; pago: number; aReceber: number };
  ocupacao: Ocupacao;
  /** Parte do faturamento da meta da unidade no mês (só quando o período é um mês com meta). */
  meta: { objetivo: number; fracao: number } | null;
  servicos: (Omit<ServicoDesempenho, 'custo' | 'lucro'> & {
    nome: string;
    duracaoPrevistaMin: number;
    custo: number | null;
    lucro: number | null;
  })[];
  produtos: (ProdutoDesempenho & { nome: string })[];
  clientes: {
    resumo: ResumoClientes;
    lista: (ClienteDoProfissional & { nome: string })[];
    /** Telefone só para dono e gestor (o barbeiro nunca vê). */
    sumidos: (ClienteSumido & { nome: string; telefone: string | null })[];
    /** Agendamentos com ele marcados como falta no período. */
    faltas: number;
  };
  rotina: ResumoRotina;
  comandas: {
    id: string;
    /** Fechamento, cancelamento ou horário marcado, em ISO. */
    data: string;
    cliente: string | null;
    itens: string[];
    total: number;
    status:
      | 'prevista'
      | 'em_atendimento'
      | 'confirmada'
      | 'pendente'
      | 'fechada'
      | 'cancelada'
      | 'reaberta';
    /** Já foi reaberta alguma vez (auditoria). */
    reaberta: boolean;
  }[];
  evolucao: {
    mes: string;
    faturamento: number;
    clientes: number;
    ticketMedio: number;
    comissao: number;
  }[];
  /** Média por profissional da unidade no período; null para o barbeiro (não compara com colegas). */
  media: Pick<
    ResumoDesempenho,
    'faturamento' | 'clientes' | 'ticketMedio' | 'percentualExtras' | 'atendimentos'
  > | null;
  /** Chega com a Etapa 12 (pesquisa depois do atendimento). */
  avaliacoes: {
    media: number;
    respostas: number;
    comentarios: { nota: number; texto: string; data: string }[];
  } | null;
}

// ─── Chamar o cliente de volta ────────────────────────────────────────────

/** Link do WhatsApp com a mensagem pronta; null sem telefone válido. Aceita com ou sem 55. */
export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string | null {
  const d = (telefone ?? '').replace(/\D/g, '');
  const numero = d.length === 10 || d.length === 11 ? `55${d}` : d;
  if (!/^55\d{10,11}$/.test(numero)) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** Convite para voltar, no tom da barbearia (o dono revisa antes de enviar). */
export function mensagemRetorno(d: {
  cliente: string;
  barbeiro: string;
  unidade: string;
  linkAgendamento: string | null;
}): string {
  const primeiro = d.cliente.trim().split(/\s+/)[0] ?? d.cliente;
  const fim = d.linkAgendamento
    ? ` Se quiser, é só escolher o horário por aqui: ${d.linkAgendamento}`
    : ' Quer que eu veja um horário para você?';
  return `Oi, ${primeiro}! Tudo bem? Aqui é da ${d.unidade}. Faz um tempinho que você não aparece e o ${d.barbeiro.split(/\s+/)[0]} lembrou de você.${fim}`;
}

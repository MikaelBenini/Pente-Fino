// Resumo do dia e do mês, dia a dia, para dono e gestor: o que tem para hoje, o que já
// foi feito e por quem. Regras puras; a API junta agenda, comandas e calendário.
import type { StatusComanda } from './comanda.js';
import type { Ocupacao } from './desempenho.js';
import { calcularIndicadores, type ComandaFechada } from './indicadores.js';
import type { DataISO } from './vigencia.js';

/** Onde cada atendimento do dia está, na linguagem do balcão. */
export type SituacaoDia =
  'a_atender' | 'em_atendimento' | 'aguardando_fechamento' | 'fechada' | 'faltou' | 'cancelada';

export const NOME_SITUACAO_DIA: Readonly<Record<SituacaoDia, string>> = {
  a_atender: 'A atender',
  em_atendimento: 'Em atendimento',
  aguardando_fechamento: 'Aguardando fechamento',
  fechada: 'Fechadas',
  faltou: 'Faltou',
  cancelada: 'Cancelada',
};

/** Situação a partir do estado (já efetivo) da comanda e do agendamento. */
export function situacaoNoDia(
  status: StatusComanda,
  agendamento?: 'agendado' | 'confirmado' | 'atendido' | 'cancelado' | 'falta' | null,
): SituacaoDia {
  if (agendamento === 'falta') return 'faltou';
  if (agendamento === 'cancelado' || status === 'cancelada') return 'cancelada';
  if (status === 'prevista') return 'a_atender';
  if (status === 'em_atendimento') return 'em_atendimento';
  if (status === 'fechada') return 'fechada';
  return 'aguardando_fechamento'; // confirmada, pendente, reaberta
}

export interface EntradaDia {
  inicio: Date;
  fim: Date;
  situacao: SituacaoDia;
  /** Passou 15 min do fim sem o barbeiro confirmar. */
  pendente: boolean;
  /** Total da comanda (previsto enquanto aberta). */
  valor: number;
}

export interface ContagemDia {
  /** Tudo que estava na agenda, menos o que foi cancelado. */
  marcados: number;
  aAtender: number;
  emAtendimento: number;
  aguardandoFechamento: number;
  pendentes: number;
  fechadas: number;
  faltas: number;
  canceladas: number;
  /** Ainda vai entrar hoje: a atender, em atendimento e aguardando fechamento. */
  valorEmAberto: number;
}

export function contarDia(entradas: readonly EntradaDia[]): ContagemDia {
  const c: ContagemDia = {
    marcados: 0,
    aAtender: 0,
    emAtendimento: 0,
    aguardandoFechamento: 0,
    pendentes: 0,
    fechadas: 0,
    faltas: 0,
    canceladas: 0,
    valorEmAberto: 0,
  };
  for (const e of entradas) {
    if (e.situacao !== 'cancelada') c.marcados++;
    if (e.pendente) c.pendentes++;
    switch (e.situacao) {
      case 'a_atender':
        c.aAtender++;
        c.valorEmAberto += e.valor;
        break;
      case 'em_atendimento':
        c.emAtendimento++;
        c.valorEmAberto += e.valor;
        break;
      case 'aguardando_fechamento':
        c.aguardandoFechamento++;
        c.valorEmAberto += e.valor;
        break;
      case 'fechada':
        c.fechadas++;
        break;
      case 'faltou':
        c.faltas++;
        break;
      case 'cancelada':
        c.canceladas++;
        break;
    }
  }
  return c;
}

/** O próximo a atender: o primeiro ainda não começado cujo horário não acabou. */
export function proximoAtendimento<T extends EntradaDia>(
  entradas: readonly T[],
  agora: Date,
): T | null {
  return (
    [...entradas]
      .filter((e) => e.situacao === 'a_atender' && e.fim > agora)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0] ?? null
  );
}

/** Aniversário no dia (compara mês e dia; 29/02 cai em 28/02 nos anos comuns). */
export function fazAniversario(aniversario: DataISO | null, dia: DataISO): boolean {
  if (!aniversario) return false;
  const md = aniversario.slice(5);
  const ano = Number(dia.slice(0, 4));
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
  return (md === '02-29' && !bissexto ? '02-28' : md) === dia.slice(5);
}

// ─── Mês, dia a dia ───────────────────────────────────────────────────────

export interface DiaDoMes {
  data: DataISO;
  /** Dia de trabalho pelo calendário (dias da semana e exceções). */
  trabalha: boolean;
  agendados: number;
  faltas: number;
  cancelados: number;
  clientes: number;
  atendimentos: number;
  faturamento: number;
  ticketMedio: number;
  comissao: number;
}

/**
 * Uma linha por dia do mês: comandas fechadas pela data do fechamento e agendamentos
 * pela data marcada (em São Paulo).
 */
export function resumoPorDia(
  dias: readonly DataISO[],
  diasDeTrabalho: readonly DataISO[],
  fechadas: readonly { data: DataISO; comanda: ComandaFechada }[],
  agendamentos: readonly { data: DataISO; status: string }[],
): DiaDoMes[] {
  const trabalho = new Set(diasDeTrabalho);
  return dias.map((data) => {
    const i = calcularIndicadores(fechadas.filter((f) => f.data === data).map((f) => f.comanda));
    const doDia = agendamentos.filter((a) => a.data === data);
    return {
      data,
      trabalha: trabalho.has(data),
      agendados: doDia.filter((a) => a.status !== 'cancelado').length,
      faltas: doDia.filter((a) => a.status === 'falta').length,
      cancelados: doDia.filter((a) => a.status === 'cancelado').length,
      clientes: i.clientes,
      atendimentos: i.atendimentos,
      faturamento: i.faturamento,
      ticketMedio: i.ticketMedio,
      comissao: i.comissoes,
    };
  });
}

// ─── Respostas da API ─────────────────────────────────────────────────────

export interface ItemDoDia {
  agendamentoId: string | null;
  comandaId: string | null;
  profissionalId: string;
  /** Horário marcado; para quem chegou sem agendamento, a hora em que a comanda abriu. */
  inicio: string;
  fim: string;
  cliente: string | null;
  clienteId: string | null;
  /** Nunca teve comanda fechada antes deste dia. */
  primeiraVez: boolean;
  aniversario: boolean;
  servicos: string[];
  valor: number;
  situacao: SituacaoDia;
  /** Estado efetivo da comanda, para a etiqueta. */
  status: StatusComanda;
  pendente: boolean;
  origem: string | null;
  observacao: string | null;
}

export interface ProfissionalDoDia {
  profissionalId: string;
  nome: string;
  unidadeId: string;
  contagem: ContagemDia;
  faturamento: number;
  comissao: number;
  clientes: number;
  ocupacao: Ocupacao;
  proximo: ItemDoDia | null;
  itens: ItemDoDia[];
}

export interface ResumoDoDia {
  data: DataISO;
  totais: ContagemDia & {
    faturamento: number;
    comissao: number;
    clientes: number;
    ticketMedio: number;
    ocupacao: Ocupacao;
    primeiraVez: number;
    aniversariantes: number;
  };
  profissionais: ProfissionalDoDia[];
}

export interface ResumoDoMes {
  mes: string;
  dias: DiaDoMes[];
  totais: Omit<DiaDoMes, 'data' | 'trabalha'> & { diasTrabalhados: number };
}

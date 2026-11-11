// Métricas do negócio na administração (Etapa 15.1): contas, receita recorrente (MRR),
// conversão do teste, cancelamentos e renovações. Regras puras; os dados vêm das funções da
// plataforma (só assinatura e contagens, nunca cliente da barbearia).
import { situacaoAssinatura, type FaturaParaSituacao } from './assinatura.js';
import { dataLocal } from './datas.js';
import {
  aplicarDesconto,
  DIAS_TESTE,
  precoPorMes,
  TABELA_PADRAO,
  tabelaVigente,
  type Ciclo,
  type PlanoConta,
  type TabelaPrecosPlanos,
} from './planos.js';

export interface ContaParaMetricas {
  id: string;
  plano: PlanoConta;
  ciclo: Ciclo;
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  criadaEm: Date;
  testeAte: Date | null;
  cobrancaAutomatica: boolean;
  canceladaEm: Date | null;
  motivoCancelamento: string | null;
  unidades: number;
  /** Data da tabela contratada (null = a do lançamento). */
  precosDesde?: string | null;
  /** Desconto do cupom (pontos-base). */
  descontoBp?: number;
  /** Conta da própria equipe: fica fora de todos os números (admin R5). */
  interna?: boolean;
  /** Cortesia (sem cobrança) até este dia, AAAA-MM-DD. */
  cortesiaAte?: string | null;
}

/**
 * Situação de uma conta para a administração (admin R5). Diferente da que a barbearia vê:
 * "em dia" só com pagamento; ativa que nunca pagou é "ativa sem cobrança"; cortesia à parte.
 */
export const SITUACOES_NA_PLATAFORMA = [
  'teste',
  'teste_vencido',
  'em_dia',
  'cortesia',
  'ativa_sem_cobranca',
  'em_atraso',
  'bloqueada',
  'suspensa',
  'cancelada',
] as const;
export type SituacaoNaPlataforma = (typeof SITUACOES_NA_PLATAFORMA)[number];

export const NOME_SITUACAO_NA_PLATAFORMA: Readonly<Record<SituacaoNaPlataforma, string>> = {
  teste: 'Teste grátis',
  teste_vencido: 'Teste terminado',
  em_dia: 'Em dia',
  cortesia: 'Cortesia',
  ativa_sem_cobranca: 'Ativa sem cobrança',
  em_atraso: 'Pagamento atrasado',
  bloqueada: 'Só para consulta (atraso)',
  suspensa: 'Bloqueada pela administração',
  cancelada: 'Cancelada',
};

export function situacaoNaPlataforma(
  c: Pick<ContaParaMetricas, 'status' | 'testeAte' | 'cortesiaAte'>,
  faturas: readonly FaturaParaSituacao[],
  agora: Date,
): SituacaoNaPlataforma {
  const s = situacaoAssinatura(c, faturas, agora).situacao;
  if (s !== 'ativa') return s;
  if (c.cortesiaAte && c.cortesiaAte >= dataLocal(agora)) return 'cortesia';
  return faturas.some((f) => f.status === 'paga') ? 'em_dia' : 'ativa_sem_cobranca';
}

export interface FaturaParaMetricas extends FaturaParaSituacao {
  contaId: string;
  valor: number;
}

export interface MetricasDaPlataforma {
  contas: {
    /** Sem as internas. */
    total: number;
    porSituacao: Record<SituacaoNaPlataforma, number>;
    /** Contas da própria equipe, contadas à parte e fora de todos os outros números. */
    internas: number;
  };
  novas: {
    hoje: number;
    ultimos7Dias: number;
    noMes: number;
    porDia: { dia: string; contas: number }[];
  };
  receita: {
    /** Receita recorrente por mês das contas que pagam (anual dividido por 12). */
    mrr: number;
    porPlano: Record<PlanoConta, number>;
    porForma: { automatica: number; manual: number };
    pagantes: number;
    ticketMedio: number;
    /** MRR de hoje mais os testes que terminam nos próximos 30 dias × a conversão. */
    previsaoProximoMes: number;
  };
  conversao: { elegiveis: number; assinaram: number; taxa: number };
  cancelamentos: {
    noMes: number;
    /** Canceladas no mês ÷ pagantes no começo do mês. */
    taxa: number;
    motivos: { motivo: string; contas: number }[];
  };
  /** Contas com duas ou mais faturas pagas (renovaram pelo menos uma vez). */
  renovaram: number;
}

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function metricasDaPlataforma(d: {
  contas: readonly ContaParaMetricas[];
  faturas: readonly FaturaParaMetricas[];
  agora: Date;
  /** Tabelas de preço: cada conta entra no MRR pelo que contratou. */
  tabelas?: readonly TabelaPrecosPlanos[];
}): MetricasDaPlataforma {
  const tabelas = d.tabelas ?? [TABELA_PADRAO];
  // Admin R5: conta interna não entra em nenhum número (MRR, conversão, gráficos, cancelamentos).
  const contas = d.contas.filter((c) => !c.interna);
  const internas = d.contas.length - contas.length;
  const preco = (c: ContaParaMetricas) =>
    aplicarDesconto(
      precoPorMes(
        c.plano,
        c.ciclo,
        Math.max(1, c.unidades),
        tabelaVigente(tabelas, c.precosDesde ?? null),
      ),
      c.descontoBp,
    );
  const hoje = dataLocal(d.agora);
  const mes = hoje.slice(0, 7);
  const porConta = new Map<string, FaturaParaMetricas[]>();
  for (const f of d.faturas) porConta.set(f.contaId, [...(porConta.get(f.contaId) ?? []), f]);
  const pagas = (id: string) => (porConta.get(id) ?? []).filter((f) => f.status === 'paga').length;

  const porSituacao = Object.fromEntries(SITUACOES_NA_PLATAFORMA.map((s) => [s, 0])) as Record<
    SituacaoNaPlataforma,
    number
  >;
  const receita = {
    mrr: 0,
    porPlano: { basico: 0, pro: 0, premium: 0 } as Record<PlanoConta, number>,
    porForma: { automatica: 0, manual: 0 },
    pagantes: 0,
  };
  for (const c of contas) {
    const situacao = situacaoNaPlataforma(c, porConta.get(c.id) ?? [], d.agora);
    porSituacao[situacao] += 1;
    // MRR: em dia ou com atraso curto, e já pagou alguma fatura. Cortesia fica de fora.
    if ((situacao === 'em_dia' || situacao === 'em_atraso') && pagas(c.id) > 0) {
      const valor = preco(c);
      receita.mrr += valor;
      receita.porPlano[c.plano] += valor;
      receita.porForma[c.cobrancaAutomatica ? 'automatica' : 'manual'] += valor;
      receita.pagantes += 1;
    }
  }

  // Conversão: contas cujo teste já acabou e quantas pagaram ao menos uma fatura.
  const elegiveis = contas.filter(
    (c) => (c.testeAte ?? new Date(c.criadaEm.getTime() + DIAS_TESTE * 86_400_000)) < d.agora,
  );
  const assinaram = elegiveis.filter((c) => pagas(c.id) > 0).length;
  const taxaConversao = elegiveis.length ? assinaram / elegiveis.length : 0;

  const em30 = new Date(d.agora.getTime() + 30 * 86_400_000);
  const vindoDoTeste = contas
    .filter(
      (c) => c.status === 'teste' && c.testeAte && c.testeAte >= d.agora && c.testeAte <= em30,
    )
    .reduce((s, c) => s + preco(c), 0);

  // Cancelamentos do mês e a base de pagantes no começo dele (pagaram antes do dia 1).
  const inicioDoMes = new Date(`${mes}-01T00:00:00-03:00`);
  const canceladasNoMes = contas.filter(
    (c) => c.canceladaEm && dataLocal(c.canceladaEm).slice(0, 7) === mes,
  );
  const baseInicio = contas.filter(
    (c) =>
      (porConta.get(c.id) ?? []).some((f) => f.status === 'paga' && f.vencimento < `${mes}-01`) &&
      (!c.canceladaEm || c.canceladaEm >= inicioDoMes),
  ).length;
  const motivos = new Map<string, number>();
  for (const c of canceladasNoMes) {
    const m = c.motivoCancelamento?.trim() || 'Sem motivo informado';
    motivos.set(m, (motivos.get(m) ?? 0) + 1);
  }

  const criadas = contas.map((c) => dataLocal(c.criadaEm));
  const porDia = Array.from({ length: 30 }, (_, i) => {
    const dia = somarDias(hoje, i - 29);
    return { dia, contas: criadas.filter((x) => x === dia).length };
  });

  return {
    contas: { total: contas.length, porSituacao, internas },
    novas: {
      hoje: criadas.filter((x) => x === hoje).length,
      ultimos7Dias: criadas.filter((x) => x > somarDias(hoje, -7)).length,
      noMes: criadas.filter((x) => x.slice(0, 7) === mes).length,
      porDia,
    },
    receita: {
      ...receita,
      ticketMedio: receita.pagantes ? Math.round(receita.mrr / receita.pagantes) : 0,
      previsaoProximoMes: receita.mrr + Math.round(vindoDoTeste * taxaConversao),
    },
    conversao: { elegiveis: elegiveis.length, assinaram, taxa: taxaConversao },
    cancelamentos: {
      noMes: canceladasNoMes.length,
      taxa: baseInicio ? canceladasNoMes.length / baseInicio : 0,
      motivos: [...motivos]
        .map(([motivo, contas]) => ({ motivo, contas }))
        .sort((a, b) => b.contas - a.contas),
    },
    renovaram: contas.filter((c) => pagas(c.id) >= 2).length,
  };
}

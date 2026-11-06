// Clube da barbearia (Etapa 13): assinatura, combo e convênio. Regras puras: ciclo da adesão,
// o que o plano cobre (RN-07) e a comissão do atendimento do clube.
import { z } from 'zod';
import { comissaoItem, type RegraComissao } from './dinheiro.js';
import type { DataISO } from './vigencia.js';

export const TIPOS_ITEM_CLUBE = ['assinatura', 'combo', 'convenio'] as const;
export type TipoItemClube = (typeof TIPOS_ITEM_CLUBE)[number];
export const NOME_TIPO_CLUBE: Readonly<Record<TipoItemClube, string>> = {
  assinatura: 'Assinatura',
  combo: 'Combo',
  convenio: 'Convênio',
};

export type SituacaoAdesao = 'ativa' | 'vencida' | 'cancelada';

// ─── Ciclo ────────────────────────────────────────────────────────────────

/** Soma meses a uma data, sem pular mês curto (31/01 + 1 mês = 28 ou 29/02). */
export function somarMeses(dia: DataISO, meses: number): DataISO {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10) as DataISO;
}

/**
 * O vencimento é o dia em que o plano renova (a próxima mensalidade). O ciclo vai do vencimento
 * anterior até a véspera: quem aderiu hoje já usa hoje.
 */
export function cicloDaAdesao(vencimento: DataISO): { de: DataISO; ate: DataISO } {
  const ate = new Date(`${vencimento}T12:00:00Z`);
  ate.setUTCDate(ate.getUTCDate() - 1);
  return { de: somarMeses(vencimento, -1), ate: ate.toISOString().slice(0, 10) as DataISO };
}

/** Em dia até a véspera do vencimento; no vencimento sem baixa, vencida. */
export function situacaoDaAdesao(
  status: SituacaoAdesao,
  vencimento: DataISO,
  hoje: DataISO,
): SituacaoAdesao {
  if (status !== 'ativa') return status;
  return hoje >= vencimento ? 'vencida' : 'ativa';
}

// ─── O que o plano cobre ──────────────────────────────────────────────────

export interface PlanoParaCobrir {
  limiteUsoMes: number | null;
  servicos: readonly { servicoId: string; quantidade: number | null }[];
}

export interface UsosDoCiclo {
  total: number;
  porServico: Readonly<Record<string, number>>;
}

/**
 * Quantas unidades do serviço o plano cobre agora (RN-07). Fora do plano, ou acima do limite
 * do serviço ou do plano, o resto entra com preço normal, como extra.
 */
export function coberturaDoServico(
  plano: PlanoParaCobrir,
  usos: UsosDoCiclo,
  servicoId: string,
  quantidade = 1,
): { cobertas: number; extras: number } {
  const incluso = plano.servicos.find((s) => s.servicoId === servicoId);
  if (!incluso) return { cobertas: 0, extras: quantidade };
  const restamServico =
    incluso.quantidade === null ? Infinity : incluso.quantidade - (usos.porServico[servicoId] ?? 0);
  const restamPlano = plano.limiteUsoMes === null ? Infinity : plano.limiteUsoMes - usos.total;
  const cobertas = Math.max(0, Math.min(quantidade, restamServico, restamPlano));
  return { cobertas, extras: quantidade - cobertas };
}

/** O que ainda resta no ciclo, por serviço (null = sem limite próprio). */
export function restantesDoCiclo(
  plano: PlanoParaCobrir,
  usos: UsosDoCiclo,
): { servicoId: string; restam: number | null }[] {
  const restamPlano =
    plano.limiteUsoMes === null ? null : Math.max(0, plano.limiteUsoMes - usos.total);
  return plano.servicos.map((s) => {
    const doServico =
      s.quantidade === null
        ? null
        : Math.max(0, s.quantidade - (usos.porServico[s.servicoId] ?? 0));
    const restam =
      doServico === null
        ? restamPlano
        : restamPlano === null
          ? doServico
          : Math.min(doServico, restamPlano);
    return { servicoId: s.servicoId, restam };
  });
}

/**
 * Comissão do atendimento do clube: o valor fixo do dono para o serviço do clube, ou a regra do
 * profissional sobre o preço de tabela da unidade na data (o barbeiro não perde por atender
 * assinante). O cliente não paga nada pelo item.
 */
export function comissaoDoClube(d: {
  precoTabela: number;
  quantidade: number;
  regraProfissional: RegraComissao | null;
  valorFixoClube: number | null;
}): number {
  if (d.valorFixoClube !== null) return d.valorFixoClube * d.quantidade;
  if (!d.regraProfissional) return 0;
  return comissaoItem(d.precoTabela * d.quantidade, d.quantidade, d.regraProfissional);
}

// ─── Entradas e respostas da API ──────────────────────────────────────────

const centavos = z.number().int().min(0).max(10_000_000);

export const itemClubeSchema = z.object({
  unidadeId: z.uuid(),
  tipo: z.enum(TIPOS_ITEM_CLUBE),
  nome: z.string().trim().min(2, { error: 'Dê um nome ao plano.' }).max(80),
  descricao: z.string().trim().max(300).nullable().default(null),
  valor: centavos,
  limiteUsoMes: z.number().int().min(1).max(100).nullable(),
  ativo: z.boolean().default(true),
  servicos: z
    .array(
      z.object({
        servicoId: z.uuid(),
        quantidade: z.number().int().min(1).max(100).nullable(),
        comissaoValorFixo: centavos.nullable(),
      }),
    )
    .min(1, { error: 'Inclua pelo menos um serviço.' })
    .refine((s) => new Set(s.map((x) => x.servicoId)).size === s.length, {
      error: 'O mesmo serviço apareceu duas vezes.',
    }),
});
export type ItemClubeEntrada = z.infer<typeof itemClubeSchema>;

export const adesaoClubeSchema = z.object({
  clienteId: z.uuid(),
  itemClubeId: z.uuid(),
  inicio: z.iso.date(),
  /** Padrão: um mês depois do início. */
  vencimento: z.iso.date().optional(),
});
export type AdesaoClubeEntrada = z.infer<typeof adesaoClubeSchema>;

export const cancelarAdesaoSchema = z.object({
  motivo: z.string().trim().min(3, { error: 'Conte o motivo em poucas palavras.' }).max(300),
});

export interface ItemClubeDetalhe {
  id: string;
  unidadeId: string;
  unidade: string;
  tipo: TipoItemClube;
  nome: string;
  descricao: string | null;
  valor: number;
  limiteUsoMes: number | null;
  ativo: boolean;
  servicos: {
    servicoId: string;
    nome: string;
    quantidade: number | null;
    comissaoValorFixo: number | null;
  }[];
  assinantes: number;
}

export interface AdesaoDetalhe {
  id: string;
  cliente: { id: string; nome: string };
  plano: { id: string; nome: string; tipo: TipoItemClube; valor: number };
  situacao: SituacaoAdesao;
  inicio: DataISO;
  vencimento: DataISO;
  usosNoCiclo: number;
  restantes: { servicoId: string; servico: string; restam: number | null }[];
}

// ─── Mensalidade ──────────────────────────────────────────────────────────

/**
 * Vencimento depois da baixa: um mês adiante, mantendo o dia. Se a adesão ficou vencida mais de
 * um ciclo, recomeça a partir de hoje (não cobra os meses parados).
 */
export function vencimentoDepoisDaBaixa(vencimento: DataISO, hoje: DataISO): DataISO {
  const proximo = somarMeses(vencimento, 1);
  return proximo <= hoje ? somarMeses(hoje, 1) : proximo;
}

export const FORMAS_MENSALIDADE = ['pix', 'dinheiro', 'debito', 'credito'] as const;

export const baixaMensalidadeSchema = z.object({
  forma: z.enum(FORMAS_MENSALIDADE),
  /** Padrão: o valor do plano. */
  valor: z.number().int().min(0).max(10_000_000).optional(),
});
export type BaixaMensalidadeEntrada = z.infer<typeof baixaMensalidadeSchema>;

/** O que a recepção mostra para o cliente pagar: QR/copia e cola do Pix da barbearia. */
export interface MensalidadePix {
  valor: number;
  vencimento: DataISO;
  /** null quando a conta não cadastrou a chave Pix. */
  copiaECola: string | null;
}

// ─── No bot ───────────────────────────────────────────────────────────────

export interface ClubeNoBot {
  planos: readonly { nome: string; valor: number; inclusos: string }[];
  /** O plano de quem está conversando, se for assinante desta unidade. */
  assinatura: {
    plano: string;
    vencimento: DataISO;
    emDia: boolean;
    restantes: readonly { servico: string; restam: number | null }[];
  } | null;
}

const ddmm = (d: DataISO) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Resposta da opção "Clube" do bot: o plano do assinante ou os planos para quem não é. */
export function textoClubeNoBot(c: ClubeNoBot, moeda: (v: number) => string): string {
  if (c.assinatura) {
    const a = c.assinatura;
    return [
      `Seu plano: ${a.plano}`,
      a.emDia
        ? `Renova em ${ddmm(a.vencimento)}.`
        : `Venceu em ${ddmm(a.vencimento)}. Fale com a recepção para renovar.`,
      '',
      'Neste mês ainda tem:',
      ...a.restantes.map((r) => `• ${r.servico}: ${r.restam === null ? 'à vontade' : r.restam}`),
    ].join('\n');
  }
  if (c.planos.length === 0) return 'Ainda não temos clube por aqui. Pergunte na recepção!';
  return [
    'Nossos planos:',
    '',
    ...c.planos.map((p) => `• ${p.nome}: ${moeda(p.valor)} por mês (${p.inclusos})`),
    '',
    'Para entrar, fale com a recepção ou responda ATENDENTE.',
  ].join('\n');
}

// ─── Relatório do clube ───────────────────────────────────────────────────

export interface LinhaPlanoNoRelatorio {
  planoId: string;
  plano: string;
  ativos: number;
  mensalidades: number;
  /** Atendimentos cobertos pelo plano no período (soma das quantidades). */
  atendimentos: number;
  comissoes: number;
  custoProdutos: number;
  /** Mensalidades − (comissões + custo de produto dos atendimentos do clube). */
  lucro: number;
}

export interface RelatorioClube {
  ativos: number;
  vencidos: number;
  novos: number;
  cancelamentos: number;
  motivosCancelamento: string[];
  mensalidades: number;
  atendimentos: number;
  comissoes: number;
  custoProdutos: number;
  lucro: number;
  porPlano: LinhaPlanoNoRelatorio[];
}

/**
 * Se o clube dá lucro: o que entrou de mensalidade (receita do clube, separada da de serviço)
 * contra o que custaram os atendimentos cobertos (comissão + produto), por plano e no total.
 */
export function resumirClube(d: {
  planos: readonly { id: string; nome: string; ativos: number }[];
  mensalidades: readonly { planoId: string; valor: number }[];
  atendimentos: readonly { planoId: string; quantidade: number; comissao: number; custo: number }[];
}): Pick<
  RelatorioClube,
  'mensalidades' | 'atendimentos' | 'comissoes' | 'custoProdutos' | 'lucro' | 'porPlano'
> {
  const porPlano = d.planos.map((p): LinhaPlanoNoRelatorio => {
    const mensalidades = d.mensalidades
      .filter((m) => m.planoId === p.id)
      .reduce((s, m) => s + m.valor, 0);
    const doPlano = d.atendimentos.filter((a) => a.planoId === p.id);
    const comissoes = doPlano.reduce((s, a) => s + a.comissao, 0);
    const custoProdutos = doPlano.reduce((s, a) => s + a.custo, 0);
    return {
      planoId: p.id,
      plano: p.nome,
      ativos: p.ativos,
      mensalidades,
      atendimentos: doPlano.reduce((s, a) => s + a.quantidade, 0),
      comissoes,
      custoProdutos,
      lucro: mensalidades - comissoes - custoProdutos,
    };
  });
  const soma = (k: 'mensalidades' | 'atendimentos' | 'comissoes' | 'custoProdutos' | 'lucro') =>
    porPlano.reduce((s, l) => s + l[k], 0);
  return {
    mensalidades: soma('mensalidades'),
    atendimentos: soma('atendimentos'),
    comissoes: soma('comissoes'),
    custoProdutos: soma('custoProdutos'),
    lucro: soma('lucro'),
    porPlano,
  };
}

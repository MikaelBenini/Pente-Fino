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

/** Ciclo que termina no vencimento: do dia seguinte ao vencimento anterior até ele (inclusive). */
export function cicloDaAdesao(vencimento: DataISO): { de: DataISO; ate: DataISO } {
  const anterior = somarMeses(vencimento, -1);
  const de = new Date(`${anterior}T12:00:00Z`);
  de.setUTCDate(de.getUTCDate() + 1);
  return { de: de.toISOString().slice(0, 10) as DataISO, ate: vencimento };
}

/** Ativa até o fim do dia do vencimento; depois, vencida até a próxima baixa. */
export function situacaoDaAdesao(
  status: SituacaoAdesao,
  vencimento: DataISO,
  hoje: DataISO,
): SituacaoAdesao {
  if (status !== 'ativa') return status;
  return hoje > vencimento ? 'vencida' : 'ativa';
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

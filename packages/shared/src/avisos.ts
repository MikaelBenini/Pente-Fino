// Central de avisos (Etapa 15): cada papel recebe só o aviso em que precisa agir. Regras puras;
// o banco grava (packages/db/src/avisos.ts) e o worker manda para o celular de quem ligou o push.
import { formatarHora, formatarMoeda } from './formatacao.js';
import type { Papel } from './papeis.js';

export const TIPOS_AVISO = ['comandas_pendentes', 'caixa_divergente'] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export const NOME_TIPO_AVISO: Readonly<Record<TipoAviso, string>> = {
  comandas_pendentes: 'Comandas esperando confirmação do barbeiro',
  caixa_divergente: 'Caixa do dia fechado com diferença',
};

/**
 * Quem recebe, em ordem: o primeiro grupo que existir na unidade leva o aviso. Comandas
 * pendentes são da recepção; sem recepção na unidade, vão para o gestor e, sem gestor, ao dono.
 */
export const QUEM_RECEBE: Readonly<Record<TipoAviso, readonly (readonly Papel[])[]>> = {
  comandas_pendentes: [['recepcao'], ['gestor'], ['dono']],
  caixa_divergente: [['gestor', 'dono']],
};

/** A rotina das comandas pendentes roda a cada 15 minutos. */
export const INTERVALO_PENDENTES_MIN = 15;

export function destinatariosDoAviso(
  tipo: TipoAviso,
  pessoas: readonly { usuarioId: string; papeis: readonly Papel[] }[],
): string[] {
  for (const grupo of QUEM_RECEBE[tipo]) {
    const ids = pessoas
      .filter((p) => p.papeis.some((x) => grupo.includes(x)))
      .map((p) => p.usuarioId);
    if (ids.length) return [...new Set(ids)];
  }
  return [];
}

export interface AvisoNovo {
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  link: string | null;
  /** Mesmo aviso, mesma chave: não repete para a mesma pessoa. */
  chave: string;
}

const primeiro = (n: string | null) => (n ? (n.trim().split(/\s+/)[0] ?? n) : 'Cliente');

export function avisoComandasPendentes(d: {
  unidadeId: string;
  novas: readonly {
    comandaId: string;
    cliente: string | null;
    profissional: string;
    fim: string;
  }[];
  total: number;
}): AvisoNovo | null {
  if (d.novas.length === 0) return null;
  const [a, ...resto] = d.novas;
  const linha = `${primeiro(a!.cliente)} (${primeiro(a!.profissional)}, até ${formatarHora(a!.fim)})`;
  const mais = resto.length ? ` e mais ${resto.length}` : '';
  return {
    tipo: 'comandas_pendentes',
    titulo:
      d.novas.length === 1
        ? 'Comanda esperando confirmação'
        : `${d.novas.length} comandas esperando confirmação`,
    texto: `${linha}${mais}. ${d.total === 1 ? '1 comanda pendente' : `${d.total} comandas pendentes`} para resolver com o barbeiro.`,
    link: '/comandas',
    chave: `pendentes:${d.unidadeId}:${d.novas
      .map((n) => n.comandaId)
      .sort()
      .join(',')}`,
  };
}

export function avisoCaixaDivergente(d: {
  caixaId: string;
  unidade: string;
  dia: string;
  totalSistema: number;
  totalInformado: number;
  fechadoPor: string | null;
}): AvisoNovo | null {
  const diferenca = d.totalInformado - d.totalSistema;
  if (diferenca === 0) return null;
  const ddmm = `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`;
  const sobra =
    diferenca > 0 ? `sobram ${formatarMoeda(diferenca)}` : `faltam ${formatarMoeda(-diferenca)}`;
  return {
    tipo: 'caixa_divergente',
    titulo: `Caixa de ${ddmm} fechado com diferença`,
    texto: `${d.unidade}: sistema ${formatarMoeda(d.totalSistema)}, contado ${formatarMoeda(d.totalInformado)} (${sobra}).${d.fechadoPor ? ` Fechado por ${primeiro(d.fechadoPor)}.` : ''}`,
    link: `/caixa?dia=${d.dia}`,
    chave: `caixa:${d.caixaId}:${d.totalInformado}`,
  };
}

export interface AvisoDetalhe {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  texto: string;
  link: string | null;
  criadoEm: string;
  lidoEm: string | null;
}

export interface CaixaDeAvisos {
  naoLidos: number;
  avisos: AvisoDetalhe[];
}

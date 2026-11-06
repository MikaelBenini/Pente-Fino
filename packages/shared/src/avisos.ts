// Central de avisos (Etapa 15): cada papel recebe só o aviso em que precisa agir. Regras puras;
// o banco grava (packages/db/src/avisos.ts) e o worker manda para o celular de quem ligou o push.
import { z } from 'zod';
import type { ResumoUnidade } from './assistente.js';
import { formatarHora, formatarMoeda } from './formatacao.js';
import type { Papel } from './papeis.js';

export const TIPOS_AVISO = [
  'comandas_pendentes',
  'caixa_divergente',
  'caixa_sem_fechar',
  'resumo_dia',
] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

export const NOME_TIPO_AVISO: Readonly<Record<TipoAviso, string>> = {
  comandas_pendentes: 'Comandas esperando confirmação do barbeiro',
  caixa_divergente: 'Caixa do dia fechado com diferença',
  caixa_sem_fechar: 'Caixa que ficou sem fechar no fim do dia',
  resumo_dia: 'Resumo do dia da unidade',
};

/**
 * Quem recebe, em ordem: o primeiro grupo que existir na unidade leva o aviso. Comandas
 * pendentes são da recepção; sem recepção na unidade, vão para o gestor e, sem gestor, ao dono.
 */
export const QUEM_RECEBE: Readonly<Record<TipoAviso, readonly (readonly Papel[])[]>> = {
  comandas_pendentes: [['recepcao'], ['gestor'], ['dono']],
  caixa_divergente: [['gestor', 'dono']],
  caixa_sem_fechar: [['gestor', 'dono']],
  resumo_dia: [['dono', 'gestor']],
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

// ─── Fim do dia ───────────────────────────────────────────────────────────

/** O fim do dia da unidade é meia hora depois do último turno de hoje. */
export const DEPOIS_DO_EXPEDIENTE_MIN = 30;

/** Minuto (desde 00:00) em que o dia da unidade acaba; null = sem expediente hoje. */
export function fimDoDiaDaUnidade(turnos: readonly { fimMin: number }[]): number | null {
  if (turnos.length === 0) return null;
  return Math.min(24 * 60 - 1, Math.max(...turnos.map((t) => t.fimMin)) + DEPOIS_DO_EXPEDIENTE_MIN);
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** Linhas do resumo do dia (aviso e e-mail): sem emoji, uma informação por linha. */
export function linhasDoResumo(r: ResumoUnidade): string[] {
  const ticket =
    r.clientes > 0 ? ` · ticket ${formatarMoeda(Math.round(r.faturamento / r.clientes))}` : '';
  return [
    `Hoje: ${formatarMoeda(r.faturamento)} em ${r.clientes} ${r.clientes === 1 ? 'cliente' : 'clientes'}${ticket}.`,
    ...(r.mes
      ? [
          `Mês: ${formatarMoeda(r.mes.faturamento)} até hoje, projeção de ${formatarMoeda(r.mes.projecao)}.`,
        ]
      : []),
    ...(r.faltas > 0 ? [`${r.faltas} ${r.faltas === 1 ? 'falta' : 'faltas'}.`] : []),
    ...(r.notasBaixas > 0
      ? [`${r.notasBaixas} ${r.notasBaixas === 1 ? 'nota baixa' : 'notas baixas'} para resolver.`]
      : []),
    ...(r.abertas > 0
      ? [`${r.abertas} ${r.abertas === 1 ? 'comanda esperando' : 'comandas esperando'} fechamento.`]
      : []),
  ];
}

export function avisoResumoDoDia(d: {
  unidadeId: string;
  dia: string;
  resumo: ResumoUnidade;
}): AvisoNovo {
  return {
    tipo: 'resumo_dia',
    titulo: `Resumo de ${ddmm(d.dia)} · ${d.resumo.unidade}`,
    texto: linhasDoResumo(d.resumo).join(' '),
    link: '/inicio',
    chave: `resumo:${d.unidadeId}:${d.dia}`,
  };
}

export function avisoCaixaSemFechar(d: {
  unidadeId: string;
  unidade: string;
  dia: string;
  recebido: number;
}): AvisoNovo | null {
  if (d.recebido <= 0) return null;
  return {
    tipo: 'caixa_sem_fechar',
    titulo: `Caixa de ${ddmm(d.dia)} ainda aberto`,
    texto: `${d.unidade}: o expediente acabou e o caixa não foi fechado (${formatarMoeda(d.recebido)} recebidos hoje). Conte a gaveta e feche.`,
    link: `/caixa?dia=${d.dia}`,
    chave: `caixa-aberto:${d.unidadeId}:${d.dia}`,
  };
}

/** E-mail do resumo do dia (para quem escolheu receber por e-mail no Perfil). */
export function emailResumoDoDia(d: {
  nome: string;
  dia: string;
  resumo: ResumoUnidade;
  link: string;
}): { assunto: string; texto: string } {
  const primeiroNome = d.nome.trim().split(/\s+/)[0] ?? d.nome;
  return {
    assunto: `Resumo de ${ddmm(d.dia)} · ${d.resumo.unidade}`,
    texto: [
      `Oi, ${primeiroNome}.`,
      '',
      ...linhasDoResumo(d.resumo),
      '',
      `Ver no painel: ${d.link}`,
      '',
      'Para parar de receber, desligue em Perfil → Avisos.',
    ].join('\n'),
  };
}

// ─── Preferências (Perfil → Avisos) ───────────────────────────────────────

export const preferenciasAvisosSchema = z.object({
  /** Tipo → vai para o celular? Sem a chave, vai (padrão ligado). */
  celular: z.partialRecord(z.enum(TIPOS_AVISO), z.boolean()).default({}),
  resumoPorEmail: z.boolean().default(false),
});
export type PreferenciasAvisos = z.infer<typeof preferenciasAvisosSchema>;

/** Lê o JSON do banco sem quebrar com lixo antigo: o que não vale vira o padrão. */
export function lerPreferenciasAvisos(json: unknown): PreferenciasAvisos {
  const r = preferenciasAvisosSchema.safeParse(json ?? {});
  return r.success ? r.data : { celular: {}, resumoPorEmail: false };
}

export const vaiParaOCelular = (p: PreferenciasAvisos, tipo: TipoAviso) =>
  p.celular[tipo] !== false;

/** Os tipos de aviso que fazem sentido para quem tem estes papéis (para o Perfil). */
export function tiposDoPapel(papeis: readonly Papel[]): TipoAviso[] {
  return TIPOS_AVISO.filter((t) => QUEM_RECEBE[t].some((g) => g.some((p) => papeis.includes(p))));
}

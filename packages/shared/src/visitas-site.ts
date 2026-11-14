// O que o visitante faz na página de vendas (pedido do dono em 13/11). Medição nossa, sem cookie de
// terceiros: um id anônimo por visita (sessionStorage), se é a primeira vez neste navegador (só com
// o aceite de cookies), até onde rolou, em quais botões clicou e de onde veio. Com o "não
// rastrear" (DNT ou GPC) ligado, o navegador não manda nada.
import { z } from 'zod';
import { dataLocal } from './datas.js';

/** Os botões que importam para o funil da página de vendas. */
export const ALVOS_CLIQUE = ['planos', 'cadastro', 'whatsapp', 'video', 'chat'] as const;
export type AlvoClique = (typeof ALVOS_CLIQUE)[number];

export const ROTULO_ALVO: Record<AlvoClique, string> = {
  planos: 'Planos',
  cadastro: 'Cadastro',
  whatsapp: 'WhatsApp',
  video: 'Vídeo',
  chat: 'Chat',
};

/** Marcas de rolagem (% da página). */
export const MARCAS_ROLAGEM = [25, 50, 75, 100] as const;

const pagina = z
  .string()
  .trim()
  .max(120)
  .regex(/^\/[\w\-/]*$/, 'Página inválida');

export const eventoVisitaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('entrada'), pagina }),
  z.object({
    tipo: z.literal('rolagem'),
    pagina,
    valor: z.literal(MARCAS_ROLAGEM),
  }),
  z.object({ tipo: z.literal('clique'), pagina, valor: z.enum(ALVOS_CLIQUE) }),
]);
export type EventoVisita = z.infer<typeof eventoVisitaSchema>;

export const loteVisitaSchema = z.object({
  visitaId: z.uuid(),
  /** true = primeira visita neste navegador; null = sem aceite de cookies (não dá para saber). */
  novo: z.boolean().nullable(),
  /** De onde veio: utm_source ou o domínio do site de origem; null = direto. */
  origem: z.string().trim().max(120).nullable(),
  eventos: z.array(eventoVisitaSchema).min(1).max(30),
});
export type LoteVisita = z.infer<typeof loteVisitaSchema>;

/** De onde veio, numa palavra: a campanha (utm_source), o site de origem ou nada (direto). */
export function origemCurta(endereco: string, referrer: string): string | null {
  try {
    const url = new URL(endereco);
    const utm = url.searchParams.get('utm_source')?.trim();
    if (utm) return utm.slice(0, 120).toLowerCase();
    if (url.searchParams.get('gclid') || url.searchParams.get('gbraid')) return 'google ads';
    if (!referrer) return null;
    const r = new URL(referrer);
    if (!r.hostname || r.hostname === url.hostname) return null;
    return r.hostname.replace(/^www\./, '').slice(0, 120);
  } catch {
    return null;
  }
}

/** Uma visita já resumida pelo banco (um registro por id de visita). */
export interface VisitaResumida {
  inicio: string;
  novo: boolean | null;
  origem: string | null;
  /** Maior marca de rolagem atingida (0 = não rolou até 25%). */
  rolou: number;
  cliques: string[];
}

export interface ResumoVisitas {
  visitas: number;
  novas: number;
  /** Quantas visitas chegaram a cada marca de rolagem. */
  rolagem: Record<(typeof MARCAS_ROLAGEM)[number], number>;
  /** Quantas visitas clicaram em cada alvo (uma vez por visita). */
  cliques: Record<AlvoClique, number>;
  /** Funil: entrou → rolou metade → viu os planos → foi ao cadastro. */
  funil: { etapa: string; visitas: number }[];
  /** As origens que mais trazem visita (até 8), "Direto" para sem origem. */
  origens: { origem: string; visitas: number }[];
}

export function resumirVisitas(visitas: readonly VisitaResumida[]): ResumoVisitas {
  const rolagem = { 25: 0, 50: 0, 75: 0, 100: 0 } as ResumoVisitas['rolagem'];
  const cliques = Object.fromEntries(ALVOS_CLIQUE.map((a) => [a, 0])) as ResumoVisitas['cliques'];
  const porOrigem = new Map<string, number>();
  let novas = 0;
  let planos = 0;
  for (const v of visitas) {
    if (v.novo) novas++;
    for (const m of MARCAS_ROLAGEM) if (v.rolou >= m) rolagem[m]++;
    const unicos = new Set(v.cliques);
    for (const a of ALVOS_CLIQUE) if (unicos.has(a)) cliques[a]++;
    if (unicos.has('planos') || unicos.has('cadastro')) planos++;
    const o = v.origem ?? 'Direto';
    porOrigem.set(o, (porOrigem.get(o) ?? 0) + 1);
  }
  return {
    visitas: visitas.length,
    novas,
    rolagem,
    cliques,
    funil: [
      { etapa: 'Entrou', visitas: visitas.length },
      { etapa: 'Rolou até a metade', visitas: rolagem[50] },
      { etapa: 'Viu os planos', visitas: planos },
      { etapa: 'Foi ao cadastro', visitas: cliques.cadastro },
    ],
    origens: [...porOrigem]
      .map(([origem, n]) => ({ origem, visitas: n }))
      .sort((a, b) => b.visitas - a.visitas || a.origem.localeCompare(b.origem))
      .slice(0, 8),
  };
}

/** Visitas e visitas novas em cada dia (no fuso de exibição), na ordem dos dias pedidos. */
export function visitasPorDia(
  visitas: readonly VisitaResumida[],
  dias: readonly string[],
): { dia: string; visitas: number; novas: number }[] {
  const conta = new Map(dias.map((d) => [d, { dia: d, visitas: 0, novas: 0 }]));
  for (const v of visitas) {
    const linha = conta.get(dataLocal(new Date(v.inicio)));
    if (!linha) continue;
    linha.visitas++;
    if (v.novo) linha.novas++;
  }
  return [...conta.values()];
}

/** O painel do /admin: hoje, os últimos 7 dias e a semana dia a dia. */
export interface PainelVisitas {
  hoje: ResumoVisitas;
  semana: ResumoVisitas;
  porDia: { dia: string; visitas: number; novas: number }[];
}

/**
 * Qual botão do funil foi clicado: a marca `data-medir` do elemento vale primeiro; senão, o
 * endereço do link (cadastro, planos, WhatsApp, vídeo). null = clique que não entra no funil.
 */
export function alvoDoClique(href: string | null, medir?: string | null): AlvoClique | null {
  if (medir && (ALVOS_CLIQUE as readonly string[]).includes(medir)) return medir as AlvoClique;
  if (!href) return null;
  if (/^\/cadastro(?:[/?#]|$)/.test(href)) return 'cadastro';
  if (/^\/planos(?:[/?#]|$)/.test(href) || href === '#planos' || href.startsWith('/#planos'))
    return 'planos';
  if (/^https?:\/\/(?:wa\.me|api\.whatsapp\.com|(?:www\.)?whatsapp\.com)\//.test(href))
    return 'whatsapp';
  if (href === '#video' || href.startsWith('/#video')) return 'video';
  return null;
}

import 'server-only';
import type { SitePublico, UnidadePublica } from '@pente-fino/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { urlDaApi } from './sessao';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Dados públicos da unidade para a prévia (WhatsApp, Instagram) e o Google, guardados por alguns
 * minutos: a página do cliente busca o resto sozinha. null = não existe ou está desligada.
 */
export async function unidadePublica(slug: string): Promise<UnidadePublica | null> {
  'use cache';
  cacheLife('minutes');
  if (!SLUG.test(slug) || slug.length > 60) return null;
  try {
    const r = await fetch(`${urlDaApi()}/publico/agendamento/${slug}`);
    return r.ok ? ((await r.json()) as UnidadePublica) : null;
  } catch {
    return null;
  }
}

/** Páginas que ligaram "Aparecer no Google" (sitemap). */
export async function paginasNoGoogle(): Promise<{ slug: string; atualizadoEm: string }[]> {
  'use cache';
  cacheLife('hours');
  try {
    const r = await fetch(`${urlDaApi()}/publico/paginas`);
    return r.ok ? ((await r.json()) as { slug: string; atualizadoEm: string }[]) : [];
  } catch {
    return [];
  }
}

/**
 * Site publicado da barbearia (seção 7). Cache curto, com a etiqueta `site-<slug>` para o painel
 * renovar na hora em que o dono publica. null = sem site publicado (a página é a de agendamento).
 */
export async function sitePublico(slug: string): Promise<SitePublico | null> {
  'use cache';
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(`site-${slug}`);
  if (!SLUG.test(slug) || slug.length > 60) return null;
  try {
    const r = await fetch(`${urlDaApi()}/publico/site/${slug}`);
    return r.ok ? ((await r.json()) as SitePublico) : null;
  } catch {
    return null;
  }
}

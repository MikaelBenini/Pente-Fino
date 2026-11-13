'use server';

import { updateTag } from 'next/cache';

/**
 * Depois de publicar ou tirar do ar (lote 7b): o site de /b/<slug> deixa de usar o que estava
 * guardado e o dono vê a mudança na hora. Só limpa o cache; quem decide é a API.
 */
export async function renovarSite(slug: string): Promise<void> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) return;
  updateTag(`site-${slug}`);
}

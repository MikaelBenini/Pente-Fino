import { VERSAO_TERMOS } from '@pente-fino/shared';
import type { MetadataRoute } from 'next';
import { URL_SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const termos = new Date(`${VERSAO_TERMOS}T12:00:00Z`);
  return [
    { url: `${URL_SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${URL_SITE}/planos`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${URL_SITE}/cadastro`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${URL_SITE}/termos`, lastModified: termos, changeFrequency: 'yearly', priority: 0.2 },
    {
      url: `${URL_SITE}/privacidade`,
      lastModified: termos,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];
}

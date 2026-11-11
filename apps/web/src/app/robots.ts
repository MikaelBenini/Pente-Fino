import type { MetadataRoute } from 'next';
import { URL_SITE } from '@/lib/site';

/**
 * Indexa o site; o app, a API e os links com token ficam de fora (site S6). As páginas das
 * barbearias (/b/<slug>) ficam liberadas aqui: quem decide se entram no Google é a própria
 * página ("Aparecer no Google" → index; desligado → noindex). /agendar só redireciona para /b/.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/app', '/convite', '/redefinir-senha', '/agendar', '/horario'],
    },
    sitemap: `${URL_SITE}/sitemap.xml`,
  };
}

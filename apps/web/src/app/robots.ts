import type { MetadataRoute } from 'next';
import { URL_SITE } from '@/lib/site';

/** Indexa só o site; o app, a API e os links com token ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/planos', '/termos', '/privacidade', '/cadastro'],
      disallow: ['/api/', '/app', '/convite', '/redefinir-senha', '/agendar'],
    },
    sitemap: `${URL_SITE}/sitemap.xml`,
  };
}

import { linkDeAgendamento, VERSAO_TERMOS } from '@pente-fino/shared';
import type { MetadataRoute } from 'next';
import { CALCULADORAS } from '@/componentes/site/pagina-calculadora';
import { POSTS_PUBLICADOS } from '@/conteudo/blog';
import { CONCORRENTES } from '@/conteudo/comparativos';
import { PAGINAS_BUSCA } from '@/conteudo/paginas-busca';
import { paginasNoGoogle } from '@/lib/servidor/pagina-publica';
import { URL_SITE } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const termos = new Date(`${VERSAO_TERMOS}T12:00:00Z`);
  // Painel P4: as páginas das barbearias que ligaram "Aparecer no Google".
  const barbearias = (await paginasNoGoogle()).map((p) => ({
    url: linkDeAgendamento(URL_SITE, p.slug),
    lastModified: new Date(p.atualizadoEm),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));
  return [
    { url: `${URL_SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${URL_SITE}/planos`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${URL_SITE}/cadastro`, changeFrequency: 'monthly', priority: 0.7 },
    // Site N1: páginas por termo de busca.
    ...PAGINAS_BUSCA.map((p) => ({
      url: `${URL_SITE}${p.caminho}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // Site N4: blog.
    { url: `${URL_SITE}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    ...POSTS_PUBLICADOS.map((p) => ({
      url: `${URL_SITE}/blog/${p.slug}`,
      lastModified: new Date(`${p.publicadoEm}T12:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    // Site N3: calculadoras grátis.
    ...CALCULADORAS.map((c) => ({
      url: `${URL_SITE}${c.caminho}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // Site N2: comparações.
    ...['/melhor-sistema-para-barbearia', ...CONCORRENTES.map((c) => `/comparativo/${c.slug}`)].map(
      (caminho) => ({
        url: `${URL_SITE}${caminho}`,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }),
    ),
    { url: `${URL_SITE}/termos`, lastModified: termos, changeFrequency: 'yearly', priority: 0.2 },
    {
      url: `${URL_SITE}/privacidade`,
      lastModified: termos,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    ...barbearias,
  ];
}

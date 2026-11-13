import { ROTULO_PAGINA, type PaginaSite } from '@pente-fino/shared';
import { Carregando } from '@pente-fino/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SiteDaBarbearia } from '@/componentes/site-barbearia/site';
import { sitePublico } from '@/lib/servidor/pagina-publica';

// Páginas internas do site da barbearia (seção 7): /b/<slug>/servicos, /equipe e /contato.
// Sem site publicado, não existem.

type Props = { params: Promise<{ slug: string; pagina: string }> };

const INTERNAS: Record<string, PaginaSite> = {
  servicos: 'servicos',
  equipe: 'equipe',
  contato: 'contato',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pagina } = await params;
  const p = INTERNAS[pagina];
  const site = p ? await sitePublico(slug) : null;
  if (!p || !site) return { title: 'Página não encontrada', robots: { index: false } };
  return {
    title: { absolute: `${ROTULO_PAGINA[p]} · ${site.barbearia}` },
    robots: site.aparecerNoGoogle ? { index: true, follow: true } : { index: false, follow: false },
  };
}

async function Conteudo({ params }: Props) {
  const { slug, pagina } = await params;
  const p = INTERNAS[pagina];
  const site = p ? await sitePublico(slug) : null;
  if (!p || !site) notFound();
  return <SiteDaBarbearia dados={site} pagina={p} base={`/b/${slug}`} />;
}

export default function Pagina({ params }: Props) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

import { Carregando } from '@pente-fino/ui';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { SiteDaBarbearia } from '@/componentes/site-barbearia/site';
import { CABECALHO_DOMINIO } from '@/lib/dominio-proprio';
import { enderecoAtual, sitePublico } from '@/lib/servidor/pagina-publica';
import { URL_SITE } from '@/lib/site';

// Site da barbearia (seção 7): /s/<endereço do site>, separado do link de agendamento
// (/b/<link>), lote 7d. Endereço trocado pelo dono: o antigo leva ao novo.

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await sitePublico(slug);
  if (!site) return { title: 'Página não encontrada', robots: { index: false, follow: false } };
  const banner = site.site.paginas.inicio.find((b) => b.tipo === 'banner' && b.visivel);
  const titulo =
    site.unidade.toLowerCase() !== site.barbearia.toLowerCase()
      ? `${site.barbearia} · ${site.unidade}`
      : site.barbearia;
  const descricao = (banner?.texto || site.site.slogan || site.barbearia).slice(0, 155);
  return {
    title: { absolute: titulo },
    description: descricao,
    alternates: { canonical: `${URL_SITE.replace(/\/$/, '')}/s/${slug}` },
    robots: site.aparecerNoGoogle ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'website',
      title: titulo,
      description: descricao,
      siteName: site.barbearia,
      locale: 'pt_BR',
    },
  };
}

async function Conteudo({ params }: Props) {
  const { slug } = await params;
  const site = await sitePublico(slug);
  if (!site) {
    const novo = await enderecoAtual('site', slug);
    if (novo) permanentRedirect(`/s/${novo}`);
    notFound();
  }
  // No domínio próprio (lote 7e) os links ficam limpos: /servicos, /agendar.
  const noDominio = !!(await headers()).get(CABECALHO_DOMINIO);
  return (
    <SiteDaBarbearia
      dados={site}
      pagina="inicio"
      base={noDominio ? '' : `/s/${slug}`}
      agendar={noDominio && site.slugAgendamento ? '/agendar' : undefined}
    />
  );
}

export default function Pagina({ params }: Props) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

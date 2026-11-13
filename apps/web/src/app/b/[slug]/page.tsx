import { jsonLdDaBarbearia, linkDeAgendamento, metadadosDaPagina } from '@pente-fino/shared';
import { Carregando } from '@pente-fino/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaAgendar } from '@/componentes/telas/agendar';
import { SiteDaBarbearia } from '@/componentes/site-barbearia/site';
import { sitePublico, unidadePublica } from '@/lib/servidor/pagina-publica';
import { URL_SITE } from '@/lib/site';

// Página pública da unidade (painel P1, P3 e P4): /b/<slug>, o endereço bom para o Instagram.
// Com o site publicado (seção 7), é o Início do site e o agendamento fica em /b/<slug>/agendar;
// sem site, continua sendo a página de agendamento (o link que já está no Instagram não muda).
// A prévia no WhatsApp e no Instagram é da barbearia (não do Pente Fino); o Google só indexa
// quando o dono liga "Aparecer no Google".

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const u = await unidadePublica(slug);
  if (!u) return { title: 'Agendar horário', robots: { index: false, follow: false } };
  const site = await sitePublico(slug);
  const { titulo, descricao } = metadadosDaPagina(u);
  if (site) {
    const banner = site.site.paginas.inicio.find((b) => b.tipo === 'banner' && b.visivel);
    const titulo =
      site.unidade.toLowerCase() !== site.barbearia.toLowerCase()
        ? `${site.barbearia} · ${site.unidade}`
        : site.barbearia;
    return {
      title: { absolute: titulo },
      description: (banner?.texto || descricao).slice(0, 155),
      alternates: { canonical: linkDeAgendamento(URL_SITE, slug) },
      robots: u.aparecerNoGoogle ? { index: true, follow: true } : { index: false, follow: false },
      openGraph: { type: 'website', title: titulo, siteName: site.barbearia, locale: 'pt_BR' },
    };
  }
  const url = linkDeAgendamento(URL_SITE, slug);
  return {
    title: { absolute: titulo },
    description: descricao,
    alternates: { canonical: url },
    robots: u.aparecerNoGoogle ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'website',
      url,
      title: titulo,
      description: descricao,
      siteName: u.barbearia,
      locale: 'pt_BR',
    },
    twitter: { card: 'summary_large_image', title: titulo, description: descricao },
  };
}

async function DadosParaOGoogle({ params }: Props) {
  const { slug } = await params;
  const u = await unidadePublica(slug);
  if (!u?.aparecerNoGoogle) return null;
  const dados = jsonLdDaBarbearia(u, linkDeAgendamento(URL_SITE, slug));
  return (
    <script
      type="application/ld+json"
      // JSON.stringify não produz "</script>"; o "<" escapado fecha qualquer brecha.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }}
    />
  );
}

async function Conteudo({ params, searchParams }: Props) {
  const { slug } = await params;
  // Link do bot (?c=…, nome e telefone preenchidos) vai direto para o agendamento.
  const site = (await searchParams).c ? null : await sitePublico(slug);
  if (site) return <SiteDaBarbearia dados={site} pagina="inicio" base={`/b/${slug}`} />;
  return <TelaAgendar slugDaRota={slug} />;
}

export default function Pagina({ params, searchParams }: Props) {
  return (
    <>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <DadosParaOGoogle params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

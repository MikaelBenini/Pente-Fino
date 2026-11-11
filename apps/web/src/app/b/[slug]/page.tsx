import { jsonLdDaBarbearia, linkDeAgendamento, metadadosDaPagina } from '@pente-fino/shared';
import { Carregando } from '@pente-fino/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaAgendar } from '@/componentes/telas/agendar';
import { unidadePublica } from '@/lib/servidor/pagina-publica';
import { URL_SITE } from '@/lib/site';

// Página pública da unidade (painel P1, P3 e P4): /b/<slug>, o endereço bom para o Instagram.
// A prévia no WhatsApp e no Instagram é da barbearia (não do Pente Fino); o Google só indexa
// quando o dono liga "Aparecer no Google".

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const u = await unidadePublica(slug);
  if (!u) return { title: 'Agendar horário', robots: { index: false, follow: false } };
  const { titulo, descricao } = metadadosDaPagina(u);
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

async function Conteudo({ params }: Props) {
  const { slug } = await params;
  return <TelaAgendar slugDaRota={slug} />;
}

export default function Pagina({ params }: Props) {
  return (
    <>
      <Suspense fallback={<Carregando />}>
        <Conteudo params={params} />
      </Suspense>
      <Suspense>
        <DadosParaOGoogle params={params} />
      </Suspense>
    </>
  );
}

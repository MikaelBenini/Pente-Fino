import { jsonLdDaBarbearia, linkDeAgendamento, metadadosDaPagina } from '@pente-fino/shared';
import { Carregando } from '@pente-fino/ui';
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import { TelaAgendar } from '@/componentes/telas/agendar';
import { enderecoAtual, unidadePublica } from '@/lib/servidor/pagina-publica';
import { URL_SITE } from '@/lib/site';

// Página pública da unidade (painel P1, P3 e P4): /b/<slug>, o endereço bom para o Instagram.
// É sempre a página de agendamento: o site da barbearia tem endereço próprio, /s/<endereço>
// (seção 7, lote 7d). Link trocado pelo dono: o antigo leva ao novo, com a mesma query.
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

async function Conteudo({ params, searchParams }: Props) {
  const { slug } = await params;
  // Endereço antigo primeiro: o dado da unidade fica em cache por minutos e ainda acharia o
  // link que o dono acabou de trocar.
  {
    const novo = await enderecoAtual('agendamento', slug);
    if (novo) {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(await searchParams))
        for (const item of [v].flat()) if (item !== undefined) query.append(k, item);
      const resto = query.toString();
      permanentRedirect(`/b/${novo}${resto ? `?${resto}` : ''}`);
    }
  }
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

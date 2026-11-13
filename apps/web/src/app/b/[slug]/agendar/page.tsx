import { Carregando } from '@pente-fino/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaAgendar } from '@/componentes/telas/agendar';
import { unidadePublica } from '@/lib/servidor/pagina-publica';

// Agendamento da unidade dentro do site (seção 7): os botões "Agendar horário" do site trazem
// para cá. Funciona com ou sem site publicado.

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const u = await unidadePublica(slug);
  return {
    title: { absolute: u ? `Agendar horário · ${u.barbearia}` : 'Agendar horário' },
    robots: { index: false, follow: true },
  };
}

async function Conteudo({ params }: Props) {
  const { slug } = await params;
  return <TelaAgendar slugDaRota={slug} />;
}

export default function Pagina({ params }: Props) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}

import { permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';

// O agendamento é o próprio /b/<slug> (lote 7d). Este endereço existiu por pouco tempo, quando o
// site ocupava o /b/<slug>: leva de volta ao link.

type Props = { params: Promise<{ slug: string }> };

async function Levar({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(`/b/${slug}`);
  return null;
}

export default function Pagina({ params }: Props) {
  return (
    <Suspense>
      <Levar params={params} />
    </Suspense>
  );
}

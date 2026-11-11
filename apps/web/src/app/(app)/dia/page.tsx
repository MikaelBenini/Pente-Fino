import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaResumoDia } from '@/componentes/telas/resumo-dia';

export const metadata: Metadata = { title: 'Resumo do dia' };

export default function Pagina() {
  return (
    <Suspense>
      <TelaResumoDia />
    </Suspense>
  );
}

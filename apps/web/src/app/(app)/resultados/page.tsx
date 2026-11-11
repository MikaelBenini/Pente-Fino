import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaResultados } from '@/componentes/telas/resultados';

export const metadata: Metadata = { title: 'Resultados do mês' };

export default function Pagina() {
  return (
    <Suspense>
      <TelaResultados />
    </Suspense>
  );
}

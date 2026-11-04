import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TelaFichaProfissional } from '@/componentes/telas/equipe-desempenho';

export const metadata: Metadata = { title: 'Ficha do profissional' };

export default function Pagina() {
  return (
    <Suspense>
      <TelaFichaProfissional />
    </Suspense>
  );
}

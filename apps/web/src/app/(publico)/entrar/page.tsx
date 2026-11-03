import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioEntrar } from '@/componentes/formularios-publicos';

export const metadata: Metadata = { title: 'Entrar' };

export default function Pagina() {
  return (
    <Suspense>
      <FormularioEntrar />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AssinarClube } from '@/componentes/assinar-clube';

export const metadata: Metadata = {
  title: 'Assinar o clube',
  description: 'Assine o clube da barbearia e pague por Pix ou cartão.',
  robots: { index: false },
};

export default function Pagina() {
  return (
    <Suspense>
      <AssinarClube />
    </Suspense>
  );
}

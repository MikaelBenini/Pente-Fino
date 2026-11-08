import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfirmarEmail } from '@/componentes/confirmar-email';

export const metadata: Metadata = { title: 'Confirmar e-mail', robots: { index: false } };

export default function Pagina() {
  return (
    <Suspense>
      <ConfirmarEmail />
    </Suspense>
  );
}

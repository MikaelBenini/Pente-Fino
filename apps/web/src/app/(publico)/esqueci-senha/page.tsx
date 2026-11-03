import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioEsqueciSenha } from '@/componentes/formularios-publicos';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function Pagina() {
  return (
    <Suspense>
      <FormularioEsqueciSenha />
    </Suspense>
  );
}

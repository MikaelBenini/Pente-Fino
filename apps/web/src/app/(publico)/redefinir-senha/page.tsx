import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioNovaSenha } from '@/componentes/formularios-publicos';

export const metadata: Metadata = { title: 'Nova senha' };

export default function Pagina() {
  return (
    <Suspense>
      <FormularioNovaSenha tipo="redefinir" />
    </Suspense>
  );
}

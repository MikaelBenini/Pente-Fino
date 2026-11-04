import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioCadastro } from '@/componentes/telas/cadastro';

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Crie a conta da sua barbearia e teste o Pente Fino por 14 dias, sem cartão.',
  alternates: { canonical: '/cadastro' },
};

export default function Pagina() {
  return (
    <Suspense>
      <FormularioCadastro />
    </Suspense>
  );
}

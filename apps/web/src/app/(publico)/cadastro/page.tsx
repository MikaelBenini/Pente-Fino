import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AvisoCookies, TagGoogle } from '@/componentes/site/tag-google';
import { FormularioCadastro } from '@/componentes/telas/cadastro';

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Crie a conta da sua barbearia e teste o Pente Fino por 14 dias, sem cartão.',
  alternates: { canonical: '/cadastro' },
};

export default function Pagina() {
  return (
    <>
      <TagGoogle />
      <Suspense>
        <FormularioCadastro />
      </Suspense>
      <AvisoCookies />
    </>
  );
}

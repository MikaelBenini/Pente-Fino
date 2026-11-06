import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Carregando } from '@pente-fino/ui';
import { TelaHorario } from '@/componentes/telas/horario';

// O link é pessoal (o token dá acesso ao horário): fora dos buscadores e sem enviar a URL.
export const metadata: Metadata = {
  title: 'Seu horário',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <TelaHorario />
    </Suspense>
  );
}

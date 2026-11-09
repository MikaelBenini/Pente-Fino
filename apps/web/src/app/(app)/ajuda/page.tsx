import type { Metadata } from 'next';
import { TelaAjuda } from '@/componentes/telas/ajuda';

export const metadata: Metadata = { title: 'Ajuda' };

export default function Pagina() {
  return <TelaAjuda />;
}

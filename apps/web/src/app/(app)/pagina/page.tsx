import type { Metadata } from 'next';
import { TelaMinhaPagina } from '@/componentes/telas/minha-pagina';

export const metadata: Metadata = { title: 'Minha página' };

export default function Pagina() {
  return <TelaMinhaPagina />;
}

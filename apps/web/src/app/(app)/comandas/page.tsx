import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Comandas' };

export default function Pagina() {
  return <Secao id="comandas" />;
}

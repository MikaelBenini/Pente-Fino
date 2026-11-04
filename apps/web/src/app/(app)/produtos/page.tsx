import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Produtos' };

export default function Pagina() {
  return <Secao id="produtos" />;
}

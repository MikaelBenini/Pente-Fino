import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Metas' };

export default function Pagina() {
  return <Secao id="metas" />;
}

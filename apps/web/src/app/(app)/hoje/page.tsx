import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Hoje' };

export default function Pagina() {
  return <Secao id="hoje" />;
}

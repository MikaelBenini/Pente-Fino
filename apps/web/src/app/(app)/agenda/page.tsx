import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Agenda' };

export default function Pagina() {
  return <Secao id="agenda" />;
}

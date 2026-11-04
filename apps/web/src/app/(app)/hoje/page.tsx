import type { Metadata } from 'next';
import { TelaHoje } from '@/componentes/telas/barbeiro';

export const metadata: Metadata = { title: 'Hoje' };

export default function Pagina() {
  return <TelaHoje />;
}

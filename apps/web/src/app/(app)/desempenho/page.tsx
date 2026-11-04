import type { Metadata } from 'next';
import { TelaDesempenho } from '@/componentes/telas/barbeiro';

export const metadata: Metadata = { title: 'Desempenho' };

export default function Pagina() {
  return <TelaDesempenho />;
}

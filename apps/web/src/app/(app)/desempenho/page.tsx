import type { Metadata } from 'next';
import { TelaDesempenhoBarbeiro } from '@/componentes/telas/equipe-desempenho';

export const metadata: Metadata = { title: 'Desempenho' };

export default function Pagina() {
  return <TelaDesempenhoBarbeiro />;
}

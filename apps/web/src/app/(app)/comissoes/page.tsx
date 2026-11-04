import type { Metadata } from 'next';
import { TelaComissoesBarbeiro } from '@/componentes/telas/barbeiro';

export const metadata: Metadata = { title: 'Comissões' };

export default function Pagina() {
  return <TelaComissoesBarbeiro />;
}

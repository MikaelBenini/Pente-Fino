import type { Metadata } from 'next';
import { TelaMetasBarbeiro } from '@/componentes/telas/barbeiro';

export const metadata: Metadata = { title: 'Metas' };

export default function Pagina() {
  return <TelaMetasBarbeiro />;
}

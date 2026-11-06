import type { Metadata } from 'next';
import { TelaClube } from '@/componentes/telas/clube';

export const metadata: Metadata = { title: 'Clube' };

export default function Pagina() {
  return <TelaClube />;
}

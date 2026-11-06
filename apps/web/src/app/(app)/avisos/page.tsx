import type { Metadata } from 'next';
import { TelaAvisos } from '@/componentes/telas/avisos';

export const metadata: Metadata = { title: 'Avisos' };

export default function Pagina() {
  return <TelaAvisos />;
}

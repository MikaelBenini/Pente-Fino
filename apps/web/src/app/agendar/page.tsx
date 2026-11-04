import type { Metadata } from 'next';
import { TelaAgendar } from '@/componentes/telas/agendar';

export const metadata: Metadata = { title: 'Agendar horário' };

export default function Pagina() {
  return <TelaAgendar />;
}

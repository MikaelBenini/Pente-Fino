import type { Metadata } from 'next';
import { TelaAgenda } from '@/componentes/telas/agenda';

export const metadata: Metadata = { title: 'Agenda' };

export default function Pagina() {
  return <TelaAgenda />;
}

import type { Metadata } from 'next';
import { TelaConversas } from '@/componentes/telas/conversas';

export const metadata: Metadata = { title: 'Conversas do bot' };

export default function Pagina() {
  return <TelaConversas />;
}

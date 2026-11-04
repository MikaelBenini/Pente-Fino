import type { Metadata } from 'next';
import { TelaBot } from '@/componentes/telas/bot';

export const metadata: Metadata = { title: 'Bot do WhatsApp' };

export default function Pagina() {
  return <TelaBot />;
}

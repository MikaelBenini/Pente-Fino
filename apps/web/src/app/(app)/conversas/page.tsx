import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Conversas do bot' };

export default function Pagina() {
  return <Secao id="conversas" />;
}

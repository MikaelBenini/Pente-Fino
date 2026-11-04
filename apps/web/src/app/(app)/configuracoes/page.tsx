import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Configurações' };

export default function Pagina() {
  return <Secao id="configuracoes" />;
}

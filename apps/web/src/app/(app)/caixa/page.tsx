import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Caixa do dia' };

export default function Pagina() {
  return <Secao id="caixa" />;
}

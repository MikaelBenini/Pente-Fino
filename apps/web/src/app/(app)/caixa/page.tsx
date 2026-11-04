import type { Metadata } from 'next';
import { TelaCaixa } from '@/componentes/telas/caixa';

export const metadata: Metadata = { title: 'Caixa do dia' };

export default function Pagina() {
  return <TelaCaixa />;
}

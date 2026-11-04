import type { Metadata } from 'next';
import { TelaProdutos } from '@/componentes/telas/produtos';

export const metadata: Metadata = { title: 'Produtos' };

export default function Pagina() {
  return <TelaProdutos />;
}

import type { Metadata } from 'next';
import { TelaComandas } from '@/componentes/telas/comandas';

export const metadata: Metadata = { title: 'Comandas' };

export default function Pagina() {
  return <TelaComandas />;
}

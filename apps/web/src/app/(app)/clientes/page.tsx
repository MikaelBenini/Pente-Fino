import type { Metadata } from 'next';
import { TelaClientes } from '@/componentes/telas/clientes';

export const metadata: Metadata = { title: 'Clientes' };

export default function Pagina() {
  return <TelaClientes />;
}

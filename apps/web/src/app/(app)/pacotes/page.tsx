import type { Metadata } from 'next';
import { TelaPacotes } from '@/componentes/telas/pacotes';

export const metadata: Metadata = { title: 'Pacotes' };

export default function Pagina() {
  return <TelaPacotes />;
}

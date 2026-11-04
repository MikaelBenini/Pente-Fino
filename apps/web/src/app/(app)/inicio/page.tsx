import type { Metadata } from 'next';
import { TelaInicio } from '@/componentes/telas/inicio';

export const metadata: Metadata = { title: 'Início' };

export default function Pagina() {
  return <TelaInicio />;
}

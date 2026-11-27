import type { Metadata } from 'next';
import { TelaOutroNegocio } from '@/componentes/telas/outro-negocio';

export const metadata: Metadata = { title: 'Abrir outro negócio' };

export default function Pagina() {
  return <TelaOutroNegocio />;
}

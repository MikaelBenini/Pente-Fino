import type { Metadata } from 'next';
import { TelaEquipe } from '@/componentes/telas/equipe';

export const metadata: Metadata = { title: 'Equipe' };

export default function Pagina() {
  return <TelaEquipe />;
}

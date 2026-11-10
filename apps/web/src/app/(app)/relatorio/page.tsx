import type { Metadata } from 'next';
import { TelaRelatorio } from '@/componentes/telas/relatorio';

export const metadata: Metadata = { title: 'Relatório do mês' };

export default function Pagina() {
  return <TelaRelatorio />;
}

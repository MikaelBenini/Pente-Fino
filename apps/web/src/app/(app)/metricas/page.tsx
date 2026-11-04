import type { Metadata } from 'next';
import { TelaMetricas } from '@/componentes/telas/metricas';

export const metadata: Metadata = { title: 'Métricas e metas' };

export default function Pagina() {
  return <TelaMetricas />;
}

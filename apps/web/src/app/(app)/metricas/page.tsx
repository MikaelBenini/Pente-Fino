import type { Metadata } from 'next';
import { Secao } from '@/componentes/secao';

export const metadata: Metadata = { title: 'Métricas e metas' };

export default function Pagina() {
  return <Secao id="metricas" />;
}

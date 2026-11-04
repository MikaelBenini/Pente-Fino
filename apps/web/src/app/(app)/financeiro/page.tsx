import type { Metadata } from 'next';
import { TelaFinanceiro } from '@/componentes/telas/financeiro';

export const metadata: Metadata = { title: 'Financeiro' };

export default function Pagina() {
  return <TelaFinanceiro />;
}

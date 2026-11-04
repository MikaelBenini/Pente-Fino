import type { Metadata } from 'next';
import { TelaResumoDia } from '@/componentes/telas/resumo-dia';

export const metadata: Metadata = { title: 'Resumo do dia' };

export default function Pagina() {
  return <TelaResumoDia />;
}

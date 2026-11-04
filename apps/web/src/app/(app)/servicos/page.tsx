import type { Metadata } from 'next';
import { TelaServicos } from '@/componentes/telas/servicos';

export const metadata: Metadata = { title: 'Serviços' };

export default function Pagina() {
  return <TelaServicos />;
}

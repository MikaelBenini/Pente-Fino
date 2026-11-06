import type { Metadata } from 'next';
import { TelaRede } from '@/componentes/telas/rede';

export const metadata: Metadata = { title: 'Painel da rede' };

export default function Pagina() {
  return <TelaRede />;
}

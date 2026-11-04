import type { Metadata } from 'next';
import { TelaConfiguracoes } from '@/componentes/telas/configuracoes';

export const metadata: Metadata = { title: 'Configurações' };

export default function Pagina() {
  return <TelaConfiguracoes />;
}

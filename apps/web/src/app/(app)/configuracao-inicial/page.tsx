import type { Metadata } from 'next';
import { TelaConfiguracaoInicial } from '@/componentes/telas/configuracao-inicial';

export const metadata: Metadata = { title: 'Primeiro acesso' };

export default function Pagina() {
  return <TelaConfiguracaoInicial />;
}

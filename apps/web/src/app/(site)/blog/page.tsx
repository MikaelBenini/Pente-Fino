import type { Metadata } from 'next';
import { ListaDoBlog } from '@/componentes/site/pagina-blog';

export const metadata: Metadata = {
  title: 'Blog: gestão de barbearia com números de verdade',
  description:
    'Lucro, comissão, preço do corte e agenda da barbearia, explicados com as contas de uma barbearia de verdade.',
  alternates: { canonical: '/blog' },
};

export default function Pagina() {
  return <ListaDoBlog />;
}

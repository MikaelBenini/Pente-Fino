import {
  metadadosComparativo,
  PaginaComparativoGeral,
} from '@/componentes/site/pagina-comparativo';

export const metadata = metadadosComparativo(
  'Melhor sistema para barbearia: como escolher',
  'Cinco perguntas para escolher o sistema da barbearia e uma tabela com Pente Fino, AppBarber, Trinks e Booksy, com a fonte e a data de cada dado.',
  '/melhor-sistema-para-barbearia',
);

export default function Pagina() {
  return <PaginaComparativoGeral />;
}

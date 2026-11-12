import { metadadosComparativo, PaginaComparativo } from '@/componentes/site/pagina-comparativo';
import { concorrente } from '@/conteudo/comparativos';

const c = concorrente('appbarber');
export const metadata = metadadosComparativo(
  'Pente Fino ou AppBarber? Comparação de preço e recursos',
  'Pente Fino e AppBarber lado a lado: quanto custa para 1, 3 e 5 barbeiros, teste, WhatsApp, comissão e nota fiscal, com a fonte e a data de cada dado.',
  '/comparativo/appbarber',
);

export default function Pagina() {
  return <PaginaComparativo c={c} />;
}

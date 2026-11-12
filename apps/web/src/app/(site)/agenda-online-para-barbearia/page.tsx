import { metadadosBusca, PaginaDeBusca } from '@/componentes/site/pagina-busca';
import { paginaBusca } from '@/conteudo/paginas-busca';

const pagina = paginaBusca('/agenda-online-para-barbearia');
export const metadata = metadadosBusca(pagina);

export default function Pagina() {
  return <PaginaDeBusca pagina={pagina} />;
}

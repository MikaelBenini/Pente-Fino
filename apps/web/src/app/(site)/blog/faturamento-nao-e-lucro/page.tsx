import { metadadosPost, PaginaPost } from '@/componentes/site/pagina-blog';
import { post } from '@/conteudo/blog';

const p = post('faturamento-nao-e-lucro');
export const metadata = metadadosPost(p);

export default function Pagina() {
  return <PaginaPost post={p} />;
}

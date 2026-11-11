// Métricas e metas virou parte de Resultados do mês (sem páginas que repetem números).
import { permanentRedirect } from 'next/navigation';

export default function Pagina() {
  permanentRedirect('/resultados');
}

// Relatório do mês virou Resultados do mês.
import { permanentRedirect } from 'next/navigation';

export default function Pagina() {
  permanentRedirect('/resultados');
}

// As metas do barbeiro já aparecem em Hoje.
import { permanentRedirect } from 'next/navigation';

export default function Pagina() {
  permanentRedirect('/hoje');
}

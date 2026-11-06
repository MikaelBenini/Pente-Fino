import type { Metadata } from 'next';
import { SoNoPlano } from '@/componentes/convite-plano';
import { TelaComissoesBarbeiro } from '@/componentes/telas/barbeiro';

export const metadata: Metadata = { title: 'Comissões' };

export default function Pagina() {
  return (
    <SoNoPlano recurso="comissoes">
      <TelaComissoesBarbeiro />
    </SoNoPlano>
  );
}

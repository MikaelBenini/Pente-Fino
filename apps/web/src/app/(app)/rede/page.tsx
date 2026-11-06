import type { Metadata } from 'next';
import { SoNoPlano } from '@/componentes/convite-plano';
import { TelaRede } from '@/componentes/telas/rede';

export const metadata: Metadata = { title: 'Painel da rede' };

export default function Pagina() {
  return (
    <SoNoPlano recurso="rede">
      <TelaRede />
    </SoNoPlano>
  );
}

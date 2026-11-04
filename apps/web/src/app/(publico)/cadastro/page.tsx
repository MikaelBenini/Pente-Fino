import type { Metadata } from 'next';
import { FormularioCadastro } from '@/componentes/telas/cadastro';

export const metadata: Metadata = { title: 'Criar conta' };

export default function Pagina() {
  return <FormularioCadastro />;
}

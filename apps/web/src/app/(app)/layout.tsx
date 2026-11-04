import { Casca } from '@/componentes/casca';

export default function LayoutApp({ children }: LayoutProps<'/'>) {
  return <Casca>{children}</Casca>;
}

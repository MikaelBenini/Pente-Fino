import type { Metadata } from 'next';
import { Casca } from '@/componentes/casca';

/** Telas logadas não aparecem em buscador. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LayoutApp({ children }: LayoutProps<'/'>) {
  return <Casca>{children}</Casca>;
}

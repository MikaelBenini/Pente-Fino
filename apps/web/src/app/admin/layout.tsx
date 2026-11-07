import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administração',
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-fundo">{children}</div>;
}

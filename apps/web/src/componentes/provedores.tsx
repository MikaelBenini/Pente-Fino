'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { ErroApi } from '@/lib/api';
import { BarraNavegacao } from './barra-navegacao';

/** Erro de rede ou do servidor tenta de novo; erro de regra (4xx) não. */
function tentarDeNovo(tentativas: number, erro: unknown): boolean {
  const transitorio = erro instanceof ErroApi && (erro.status === 0 || erro.status >= 500);
  return transitorio && tentativas < 2;
}

function RegistrarServiceWorker() {
  useEffect(() => {
    // Em desenvolvimento o service worker atrapalharia a recarga automática.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => undefined);
  }, []);
  return null;
}

export function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: tentarDeNovo, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={cliente}>
      <RegistrarServiceWorker />
      {/* Lê o endereço (usePathname): em rota com parte dinâmica (/b/<slug>), fora de um
          Suspense, a pré-renderização para. A barra não mostra nada até a navegação. */}
      <Suspense fallback={null}>
        <BarraNavegacao />
      </Suspense>
      {children}
    </QueryClientProvider>
  );
}

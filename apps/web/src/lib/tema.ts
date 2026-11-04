'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type Tema = 'escuro' | 'claro';
const CHAVE = 'pf-tema';

/** Roda no <head> antes da pintura: evita piscar o tema errado. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem('${CHAVE}')==='claro')document.documentElement.dataset.theme='light'}catch(e){}`;

function ler(): Tema {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
    ? 'claro'
    : 'escuro';
}

const ouvintes = new Set<() => void>();

export function useTema(): [Tema, (t: Tema) => void] {
  const tema = useSyncExternalStore(
    useCallback((o: () => void) => {
      ouvintes.add(o);
      return () => ouvintes.delete(o);
    }, []),
    ler,
    () => 'escuro' as Tema,
  );
  const definir = useCallback((t: Tema) => {
    if (t === 'claro') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      // Sem armazenamento: vale até recarregar.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', t === 'claro' ? '#f3f4f1' : '#0b0b0b');
    ouvintes.forEach((o) => o());
  }, []);
  return [tema, definir];
}

'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Barra fina no topo enquanto a próxima tela carrega (o Next não avisa quando uma
 * navegação começa). Começa no clique de um link interno para outra rota e termina
 * quando o endereço muda; se nada mudar em 10 s, some sozinha. Mexe só no DOM dela.
 */
export function BarraNavegacao() {
  const barra = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let limite: ReturnType<typeof setTimeout> | undefined;
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const destino = new URL(a.href, window.location.href);
      if (
        destino.origin !== window.location.origin ||
        destino.pathname === window.location.pathname
      )
        return;
      if (barra.current) barra.current.dataset.estado = 'indo';
      clearTimeout(limite);
      limite = setTimeout(() => {
        if (barra.current) barra.current.dataset.estado = 'parado';
      }, 10_000);
    };
    document.addEventListener('click', aoClicar, true);
    return () => {
      document.removeEventListener('click', aoClicar, true);
      clearTimeout(limite);
    };
  }, []);

  useEffect(() => {
    const el = barra.current;
    if (!el || el.dataset.estado !== 'indo') return;
    el.dataset.estado = 'chegou';
    const t = setTimeout(() => {
      el.dataset.estado = 'parado';
    }, 450);
    return () => clearTimeout(t);
  }, [pathname]);

  return <div ref={barra} aria-hidden data-estado="parado" className="barra-navegacao" />;
}

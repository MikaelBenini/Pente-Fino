'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn.js';

export interface DialogoProps {
  aberto: boolean;
  titulo: string;
  descricao?: ReactNode;
  onFechar: () => void;
  children: ReactNode;
  largura?: 'normal' | 'larga';
}

/** Janela para formulários. No celular ocupa a largura toda e rola por dentro. */
export function Dialogo({
  aberto,
  titulo,
  descricao,
  onFechar,
  children,
  largura = 'normal',
}: DialogoProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal?.();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      className={cn(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-borda bg-superficie p-0 text-tinta backdrop:bg-black/70',
        largura === 'larga' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {aberto && (
        <div className="flex flex-col gap-5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id={`${id}-titulo`} className="text-xl font-semibold text-balance">
                {titulo}
              </h2>
              {descricao && <div className="text-sm text-tinta-suave">{descricao}</div>}
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="grid size-11 shrink-0 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

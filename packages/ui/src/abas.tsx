'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn.js';

export interface Aba {
  id: string;
  rotulo: string;
  conteudo: ReactNode;
}

/** Abas acessíveis (setas do teclado trocam de aba). */
export function Abas({
  abas,
  atual,
  onTrocar,
  rotulo,
}: {
  abas: Aba[];
  atual: string;
  onTrocar: (id: string) => void;
  rotulo: string;
}) {
  const base = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const indice = Math.max(
    0,
    abas.findIndex((a) => a.id === atual),
  );

  function teclado(e: KeyboardEvent) {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!passo) return;
    e.preventDefault();
    const proximo = (indice + passo + abas.length) % abas.length;
    onTrocar(abas[proximo]!.id);
    botoes.current[proximo]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={rotulo}
        onKeyDown={teclado}
        className="flex gap-1 overflow-x-auto border-b border-borda"
      >
        {abas.map((a, i) => {
          const ativa = i === indice;
          return (
            <button
              key={a.id}
              ref={(el) => {
                botoes.current[i] = el;
              }}
              id={`${base}-aba-${a.id}`}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={`${base}-painel-${a.id}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => onTrocar(a.id)}
              className={cn(
                '-mb-px min-h-11 shrink-0 border-b-2 px-4 font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
                ativa
                  ? 'border-modulo text-tinta'
                  : 'border-transparent text-tinta-suave hover:text-tinta',
              )}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>
      {abas.map((a, i) => (
        <div
          key={a.id}
          id={`${base}-painel-${a.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-aba-${a.id}`}
          hidden={i !== indice}
        >
          {i === indice && <div className="animar-entrada">{a.conteudo}</div>}
        </div>
      ))}
    </div>
  );
}

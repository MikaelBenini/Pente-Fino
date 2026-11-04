import { Check } from 'lucide-react';
import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from './cn.js';

export interface MarcadorProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  rotulo: string;
  /** "ficha": botão compacto (dias da semana); "linha": caixa com texto ao lado. */
  forma?: 'ficha' | 'linha';
  ref?: Ref<HTMLInputElement>;
}

/** Caixa de marcação nativa (teclado e leitor de tela funcionam), com 44 px de alvo. */
export function Marcador({ id, rotulo, forma = 'linha', className, ...props }: MarcadorProps) {
  if (forma === 'ficha') {
    return (
      <label htmlFor={id} className={cn('relative inline-flex', className)}>
        <input id={id} type="checkbox" className="peer sr-only" {...props} />
        <span
          className={cn(
            'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-borda px-3 font-denso text-base font-semibold text-tinta-suave',
            'peer-checked:border-modulo peer-checked:bg-modulo peer-checked:text-sobre-modulo',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foco',
          )}
        >
          {rotulo}
        </span>
      </label>
    );
  }
  return (
    <label
      htmlFor={id}
      className={cn('inline-flex min-h-11 cursor-pointer items-center gap-3', className)}
    >
      <span className="relative grid size-6 place-items-center">
        <input
          id={id}
          type="checkbox"
          className="peer size-6 appearance-none rounded-sm border border-borda-forte bg-superficie checked:border-acao checked:bg-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          {...props}
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute size-4 text-sobre-acao opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
      <span className="text-tinta">{rotulo}</span>
    </label>
  );
}

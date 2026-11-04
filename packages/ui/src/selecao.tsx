import { ChevronDown } from 'lucide-react';
import type { Ref, SelectHTMLAttributes } from 'react';
import { cn } from './cn.js';

export interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  opcoes: { valor: string; rotulo: string }[];
  ref?: Ref<HTMLSelectElement>;
}

export function Selecao({ id, rotulo, erro, dica, opcoes, className, ...props }: SelecaoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : dica ? `${id}-dica` : undefined}
          className={cn(
            'min-h-11 w-full appearance-none rounded-md border bg-superficie pr-10 pl-3 text-base text-tinta',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
            erro ? 'border-perigo-texto' : 'border-borda',
            className,
          )}
          {...props}
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-tinta-suave"
        />
      </div>
      {erro && (
        <p id={`${id}-erro`} className="text-sm text-perigo-texto">
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-sm text-tinta-suave">
          {dica}
        </p>
      )}
    </div>
  );
}

import { CircleAlert } from 'lucide-react';
import type { InputHTMLAttributes, Ref } from 'react';
import { cn } from './cn.js';

export interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  rotulo: string;
  /** Orientação curta abaixo do campo. */
  dica?: string;
  /** Mensagem de erro; também marca o campo como inválido para leitores de tela. */
  erro?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Campo({ id, rotulo, dica, erro, className, ...props }: CampoProps) {
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idDica].filter(Boolean).join(' ') || undefined}
        className={cn(
          'min-h-11 w-full rounded-md border bg-superficie px-3 text-base text-tinta placeholder:text-tinta-fraca',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
          erro ? 'border-perigo-texto' : 'border-borda',
          className,
        )}
        {...props}
      />
      {erro && (
        <p id={idErro} className="flex items-start gap-1.5 text-sm text-perigo-texto">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={idDica} className="text-sm text-tinta-suave">
          {dica}
        </p>
      )}
    </div>
  );
}

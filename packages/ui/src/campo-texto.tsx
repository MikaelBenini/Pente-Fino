import { CircleAlert } from 'lucide-react';
import type { Ref, TextareaHTMLAttributes } from 'react';
import { cn } from './cn.js';

export interface CampoTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  rotulo: string;
  dica?: string;
  erro?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Texto de várias linhas (mensagens do bot, observações). Cresce com o conteúdo onde o navegador sabe. */
export function CampoTexto({
  id,
  rotulo,
  dica,
  erro,
  className,
  rows = 3,
  ...props
}: CampoTextoProps) {
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idDica].filter(Boolean).join(' ') || undefined}
        className={cn(
          'w-full resize-y rounded-md border bg-superficie px-3 py-2 text-base text-tinta placeholder:text-tinta-fraca [field-sizing:content] min-h-20',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
          'disabled:cursor-not-allowed disabled:opacity-70',
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

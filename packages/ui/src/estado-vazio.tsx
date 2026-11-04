import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn.js';

export interface EstadoVazioProps {
  icone: LucideIcon;
  titulo: string;
  /** O que vai aparecer aqui e como começar. */
  texto: ReactNode;
  acao?: ReactNode;
  className?: string;
}

/** Tela sem dados que orienta o próximo passo ("Cadastre seu primeiro serviço"). */
export function EstadoVazio({ icone: Icone, titulo, texto, acao, className }: EstadoVazioProps) {
  return (
    <section
      className={cn(
        'flex flex-col items-start gap-3 rounded-lg border border-dashed border-borda-forte p-6 sm:p-8',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-md bg-superficie-2 text-modulo-texto">
        <Icone aria-hidden className="size-5" strokeWidth={1.75} />
      </span>
      <h2 className="text-xl font-semibold text-balance text-tinta">{titulo}</h2>
      <div className="max-w-prose text-tinta-suave">{texto}</div>
      {acao}
    </section>
  );
}

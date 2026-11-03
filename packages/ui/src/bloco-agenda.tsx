import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn.js';
import { ESTADOS_COMANDA, EtiquetaEstado, type EstadoComanda } from './etiqueta-estado.js';

const FAIXA: Record<EstadoComanda, string> = {
  prevista: 'bg-borda-forte',
  em_atendimento: 'bg-modulo',
  confirmada: 'bg-acao',
  pendente: 'bg-aviso',
  fechada: 'bg-superficie-3',
  cancelada: 'bg-perigo',
  reaberta: 'bg-plano-pro',
};

export interface BlocoAgendaProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** "09:00". */
  inicio: string;
  /** "09:45". */
  fim: string;
  cliente: string;
  servico: string;
  estado: EstadoComanda;
  /** Altura proporcional à duração, em px (a grade da agenda calcula). */
  altura?: number;
}

/** Cliente, serviço e horário; a faixa lateral e a etiqueta mostram o estado da comanda. */
export function BlocoAgenda({
  inicio,
  fim,
  cliente,
  servico,
  estado,
  altura,
  className,
  ...props
}: BlocoAgendaProps) {
  return (
    <button
      type="button"
      aria-label={`${inicio} a ${fim}, ${cliente}, ${servico}, ${ESTADOS_COMANDA[estado].rotulo}`}
      className={cn(
        'relative flex w-full min-h-11 overflow-hidden rounded-md border border-borda bg-superficie text-left',
        'hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
        className,
      )}
      style={altura ? { height: altura } : undefined}
      {...props}
    >
      <span aria-hidden className={cn('w-1.5 shrink-0', FAIXA[estado])} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
        <span className="flex items-center justify-between gap-2">
          <span className="font-denso text-sm font-semibold tabular-nums text-tinta-suave">
            {inicio}–{fim}
          </span>
          <EtiquetaEstado estado={estado} className="text-xs" />
        </span>
        <span className="truncate font-semibold text-tinta">{cliente}</span>
        <span className="truncate text-sm text-tinta-suave">{servico}</span>
      </span>
    </button>
  );
}

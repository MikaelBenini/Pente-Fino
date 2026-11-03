import { cn } from './cn.js';

export type EstadoComanda =
  'prevista' | 'em_atendimento' | 'confirmada' | 'pendente' | 'fechada' | 'cancelada' | 'reaberta';

/** Rótulo e tom de cada estado. O texto sempre aparece: estado nunca só pela cor. */
export const ESTADOS_COMANDA: Record<EstadoComanda, { rotulo: string; classe: string }> = {
  prevista: { rotulo: 'Prevista', classe: 'border-borda-forte text-tinta-suave' },
  em_atendimento: {
    rotulo: 'Em atendimento',
    classe: 'border-transparent bg-modulo text-sobre-modulo',
  },
  confirmada: { rotulo: 'Confirmada', classe: 'border-transparent bg-acao text-sobre-acao' },
  pendente: { rotulo: 'Pendente', classe: 'border-aviso-texto text-aviso-texto' },
  fechada: { rotulo: 'Fechada', classe: 'border-transparent bg-superficie-3 text-tinta' },
  cancelada: {
    rotulo: 'Cancelada',
    classe: 'border-perigo-texto text-perigo-texto line-through decoration-1',
  },
  reaberta: { rotulo: 'Reaberta', classe: 'border-transparent bg-plano-pro text-sobre-modulo' },
};

export function EtiquetaEstado({
  estado,
  className,
}: {
  estado: EstadoComanda;
  className?: string;
}) {
  const { rotulo, classe } = ESTADOS_COMANDA[estado];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 font-denso text-sm font-semibold uppercase tracking-wide whitespace-nowrap',
        classe,
        className,
      )}
    >
      {rotulo}
    </span>
  );
}

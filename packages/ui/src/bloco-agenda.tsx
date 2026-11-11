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
  /** Nome encurtado ("Vitor M.") para o bloco curto; sem ele, usa o nome inteiro. */
  clienteCurto?: string;
  /** O cliente confirmou pelo lembrete do WhatsApp. */
  confirmado?: boolean;
}

/** Cliente, serviço e horário; a faixa lateral e a etiqueta mostram o estado da comanda. */
/** Abaixo disso (px), o bloco vira uma linha só. 30 min na grade padrão ficam abaixo. */
const ALTURA_COMPACTA = 72;

export function BlocoAgenda({
  inicio,
  fim,
  cliente,
  servico,
  estado,
  altura,
  clienteCurto,
  confirmado = false,
  className,
  ...props
}: BlocoAgendaProps) {
  const descricao = `${inicio} a ${fim}, ${cliente}, ${servico}, ${ESTADOS_COMANDA[estado].rotulo}${confirmado ? ', cliente confirmou' : ''}`;
  // Painel M9: em 30 minutos (bloco baixo), três linhas cortavam o nome do cliente. Uma linha só,
  // "10:00 Vitor M. · Corte", com o texto inteiro na dica e no leitor de tela.
  if (altura !== undefined && altura < ALTURA_COMPACTA)
    return (
      <button
        type="button"
        aria-label={descricao}
        title={descricao}
        className={cn(
          'relative flex w-full min-h-11 items-center overflow-hidden rounded-md border border-borda bg-superficie text-left',
          'hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foco',
          className,
        )}
        style={{ height: altura }}
        {...props}
      >
        <span aria-hidden className={cn('w-1.5 self-stretch shrink-0', FAIXA[estado])} />
        <span className="flex min-w-0 flex-1 items-center gap-1.5 px-2 text-sm">
          <span className="shrink-0 font-denso font-semibold tabular-nums text-tinta-suave">
            {inicio}
          </span>
          <span className="truncate">
            <span className="font-semibold text-tinta">{clienteCurto ?? cliente}</span>
            <span className="text-tinta-suave"> · {servico}</span>
          </span>
          {confirmado && <span className="shrink-0 text-xs font-semibold text-acao-texto">✓</span>}
        </span>
      </button>
    );
  return (
    <button
      type="button"
      aria-label={descricao}
      title={descricao}
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
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold text-tinta">{cliente}</span>
          {confirmado && (
            <span className="shrink-0 text-xs font-semibold text-acao-texto">✓ confirmou</span>
          )}
        </span>
        <span className="truncate text-sm text-tinta-suave">{servico}</span>
      </span>
    </button>
  );
}

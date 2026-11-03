import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn.js';

export type VarianteBotao = 'acao' | 'secundario' | 'perigo' | 'fantasma';

const VARIANTES: Record<VarianteBotao, string> = {
  acao: 'bg-acao text-sobre-acao hover:brightness-95',
  secundario: 'bg-superficie-2 text-tinta border border-borda hover:bg-superficie-3',
  perigo: 'bg-perigo text-sobre-perigo hover:brightness-95',
  fantasma: 'text-tinta-suave hover:text-tinta hover:bg-superficie-2',
};

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  /** Mostra o giro e bloqueia o botão (o texto continua visível). */
  carregando?: boolean;
  larguraTotal?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Alvo de toque mínimo de 44 px (min-h-11). */
export function Botao({
  variante = 'acao',
  carregando = false,
  larguraTotal = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: BotaoProps) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTES[variante],
        larguraTotal && 'w-full',
        className,
      )}
      {...props}
    >
      {carregando && (
        <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      )}
      {children}
    </button>
  );
}

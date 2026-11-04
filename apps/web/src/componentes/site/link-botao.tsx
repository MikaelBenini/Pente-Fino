import { cn } from '@pente-fino/ui';
import Link from 'next/link';
import type { ComponentProps } from 'react';

const VARIANTES = {
  acao: 'bg-acao text-sobre-acao hover:brightness-110',
  contorno: 'border border-borda-forte text-tinta hover:bg-superficie-2',
  modulo: 'bg-modulo text-sobre-modulo hover:brightness-110',
} as const;

/** Link com cara de botão (navegação de verdade, não <button>). */
export function LinkBotao({
  variante = 'acao',
  grande = false,
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: keyof typeof VARIANTES; grande?: boolean }) {
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-5 font-semibold transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
        grande ? 'min-h-13 text-lg' : 'min-h-11 text-base',
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  );
}

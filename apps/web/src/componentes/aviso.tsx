import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@pente-fino/ui';

const TONS = {
  erro: { icone: CircleAlert, classe: 'border-perigo-texto/50 text-perigo-texto' },
  sucesso: { icone: CircleCheck, classe: 'border-acao-texto/50 text-acao-texto' },
  info: { icone: Info, classe: 'border-borda-forte text-tinta-suave' },
  aviso: { icone: TriangleAlert, classe: 'border-aviso-texto/50 text-aviso-texto' },
};

/** Mensagem de bloco (erro geral do formulário, confirmação). Lida por leitores de tela. */
export function Aviso({
  tom,
  children,
  className,
}: {
  tom: keyof typeof TONS;
  children: ReactNode;
  className?: string;
}) {
  const { icone: Icone, classe } = TONS[tom];
  return (
    <div
      role={tom === 'erro' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-md border bg-superficie px-3 py-2.5 text-sm',
        classe,
        className,
      )}
    >
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="text-tinta">{children}</div>
    </div>
  );
}

import { cn } from './cn.js';

/** Bloco de carregamento. Respeita "reduzir movimento". */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-md bg-superficie-2 animate-pulse motion-reduce:animate-none',
        className,
      )}
    />
  );
}

export function Carregando({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{rotulo}</span>
      <Esqueleto className="h-8 w-48" />
      <Esqueleto className="h-24 w-full" />
      <Esqueleto className="h-24 w-full" />
    </div>
  );
}

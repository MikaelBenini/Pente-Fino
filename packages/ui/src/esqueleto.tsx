import { cn } from './cn.js';

/** Bloco de carregamento com um brilho que passa. Parado em "reduzir movimento". */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('esqueleto-brilho block rounded-md bg-superficie-2', className)}
    />
  );
}

/**
 * Carregando com o desenho de uma tela típica (números no alto, lista embaixo), para
 * a troca para o conteúdo real não pular. Só aparece depois de um instante: carga
 * rápida não pisca.
 */
export function Carregando({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-4 [animation:entrar_var(--ritmo)_var(--curva-saida)_180ms_both]"
    >
      <span className="sr-only">{rotulo}</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4',
              i > 1 && 'hidden sm:flex',
            )}
          >
            <Esqueleto className="h-3 w-24" />
            <Esqueleto className="h-8 w-32" />
            <Esqueleto className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Esqueleto className="h-5 w-14" />
            <div className="flex flex-1 flex-col gap-2">
              <Esqueleto className="h-4 w-2/5" />
              <Esqueleto className="h-3 w-3/5" />
            </div>
            <Esqueleto className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

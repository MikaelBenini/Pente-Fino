import { cn } from '@pente-fino/ui';

/** Pente fino: lombada com dentes curtos e regulares. */
export function IconeMarca({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('text-modulo', className)}
      fill="currentColor"
    >
      <rect x="3" y="7" width="26" height="6" rx="1.5" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={4 + i * 2.85} y="13" width="1.6" height={i % 2 === 0 ? 12 : 9} rx="0.6" />
      ))}
    </svg>
  );
}

export function Marca({
  className,
  compacta = false,
  nomeSoNoComputador = false,
}: {
  className?: string;
  compacta?: boolean;
  /** No celular estreito, só o ícone (o nome continua para o leitor de tela). */
  nomeSoNoComputador?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <IconeMarca className={compacta ? 'size-7' : 'size-8'} />
      <span
        className={cn(
          'font-denso text-xl font-bold uppercase leading-none tracking-wide whitespace-nowrap text-tinta',
          nomeSoNoComputador && 'max-sm:sr-only',
        )}
      >
        Pente Fino
      </span>
    </span>
  );
}

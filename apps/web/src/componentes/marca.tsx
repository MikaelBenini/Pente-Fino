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

export function Marca({ className, compacta = false }: { className?: string; compacta?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <IconeMarca className={compacta ? 'size-7' : 'size-8'} />
      <span className="font-denso text-xl font-bold uppercase leading-none tracking-wide text-tinta">
        Pente Fino
      </span>
    </span>
  );
}

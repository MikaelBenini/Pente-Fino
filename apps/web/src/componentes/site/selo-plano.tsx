// Selo discreto ao lado de cada promessa do site que não vem em todos os planos (briefing do site,
// P1). Lê o plano da mesma regra que a API usa para liberar o recurso: o site nunca promete o que
// o plano não tem.
import { NOME_PLANO, RECURSOS, type PlanoConta, type Recurso } from '@pente-fino/shared';
import { cn } from '@pente-fino/ui';

const TEXTO: Record<Exclude<PlanoConta, 'basico'>, string> = {
  pro: 'Pro e Premium',
  premium: 'Premium',
};

/** Recurso vem desde o Básico: nada a mostrar. */
export function SeloPlano({
  recurso,
  plano,
  className,
}: {
  recurso?: Recurso;
  /** Para promessas que não são um recurso da API (ex.: "várias unidades"). */
  plano?: PlanoConta;
  className?: string;
}) {
  const desde = plano ?? (recurso ? RECURSOS[recurso].desde : 'basico');
  if (desde === 'basico') return null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm border border-modulo/50 px-1.5 py-px align-middle font-sans text-xs font-semibold tracking-normal text-modulo-texto normal-case',
        className,
      )}
      title={`Vem no plano ${NOME_PLANO[desde]}${desde === 'pro' ? ' e no Premium' : ''}`}
    >
      {TEXTO[desde]}
    </span>
  );
}

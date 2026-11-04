// Limites dos planos (CLAUDE.md e docs/, seção 7). A API aplica; a tela explica.

export const PLANOS = ['basico', 'pro', 'premium'] as const;
export type PlanoConta = (typeof PLANOS)[number];

export interface LimitesPlano {
  unidades: number;
  profissionais: number;
}

export const LIMITES_PLANO: Readonly<Record<PlanoConta, LimitesPlano>> = {
  basico: { unidades: 1, profissionais: 3 },
  pro: { unidades: 1, profissionais: 10 },
  premium: { unidades: Number.POSITIVE_INFINITY, profissionais: Number.POSITIVE_INFINITY },
};

export const NOME_PLANO: Readonly<Record<PlanoConta, string>> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
};

/** Mensagem quando o limite foi alcançado, ou null se ainda cabe. */
export function verificarLimite(
  plano: PlanoConta,
  recurso: keyof LimitesPlano,
  emUso: number,
): string | null {
  const limite = LIMITES_PLANO[plano][recurso];
  if (emUso < limite) return null;
  const nome =
    recurso === 'unidades' ? (limite === 1 ? 'unidade' : 'unidades') : 'profissionais ativos';
  return `O plano ${NOME_PLANO[plano]} permite ${limite} ${nome}. Para adicionar mais, mude para um plano maior.`;
}

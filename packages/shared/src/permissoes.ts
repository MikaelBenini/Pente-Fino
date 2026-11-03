// Quem pode o quê, por papel e unidade. Matriz completa: docs/documentacao-do-produto.md (TRD).
import type { Papel } from './papeis.js';

/** Papel do usuário numa unidade; unidade vazia = todas as unidades da conta. */
export interface PapelAtribuido {
  papel: Papel;
  unidadeId: string | null;
}

/** O usuário tem algum dos papéis (em qualquer unidade)? */
export function temAlgumPapel(
  papeis: readonly PapelAtribuido[],
  aceitos: readonly Papel[],
): boolean {
  return papeis.some((p) => aceitos.includes(p.papel));
}

/** Papéis que valem numa unidade: os da unidade e os de "todas as unidades". */
export function papeisNaUnidade(papeis: readonly PapelAtribuido[], unidadeId: string): Papel[] {
  return [
    ...new Set(
      papeis.filter((p) => p.unidadeId === null || p.unidadeId === unidadeId).map((p) => p.papel),
    ),
  ];
}

/** O usuário pode agir nesta unidade com algum dos papéis aceitos? */
export function podeNaUnidade(
  papeis: readonly PapelAtribuido[],
  unidadeId: string,
  aceitos: readonly Papel[],
): boolean {
  return papeisNaUnidade(papeis, unidadeId).some((p) => aceitos.includes(p));
}

/**
 * Unidades que o usuário alcança com algum dos papéis aceitos.
 * `'todas'` quando algum desses papéis vale na conta inteira.
 */
export function unidadesPermitidas(
  papeis: readonly PapelAtribuido[],
  aceitos: readonly Papel[],
): 'todas' | string[] {
  const validos = papeis.filter((p) => aceitos.includes(p.papel));
  if (validos.some((p) => p.unidadeId === null)) return 'todas';
  return [...new Set(validos.map((p) => p.unidadeId as string))];
}

/** Papéis que cada papel pode convidar. Gestor não cria dono nem outro gestor. */
export const PODE_CONVIDAR: Readonly<Record<Papel, readonly Papel[]>> = {
  dono: ['dono', 'gestor', 'recepcao', 'barbeiro'],
  gestor: ['recepcao', 'barbeiro'],
  recepcao: [],
  barbeiro: [],
};

// Escopo por unidade: o que o usuário alcança com os papéis aceitos na rota.
import { podeNaUnidade, unidadesPermitidas, type Papel } from '@pente-fino/shared';
import { Contexto } from './contexto.js';
import { Erros } from './erros.js';

export const GESTAO: Papel[] = ['dono', 'gestor'];
export const TODOS: Papel[] = ['dono', 'gestor', 'recepcao', 'barbeiro'];

/** Filtro Prisma por unidade: {} quando alcança todas, { unidadeId: { in } } quando não. */
export function filtroUnidade(
  aceitos: readonly Papel[],
  campo = 'unidadeId',
): Record<string, unknown> {
  const alcance = unidadesPermitidas(Contexto.usuario().papeis, aceitos);
  return alcance === 'todas' ? {} : { [campo]: { in: alcance } };
}

/** Lança 403 se o usuário não tem um dos papéis na unidade. */
export function exigirUnidade(unidadeId: string, aceitos: readonly Papel[]): void {
  if (!podeNaUnidade(Contexto.usuario().papeis, unidadeId, aceitos)) throw Erros.semPermissao();
}

export function temPapelNaUnidade(unidadeId: string, aceitos: readonly Papel[]): boolean {
  return podeNaUnidade(Contexto.usuario().papeis, unidadeId, aceitos);
}

/** Data AAAA-MM-DD como o Prisma grava colunas date (meia-noite UTC). */
export function data(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}

export function dataTexto(d: Date): string {
  return d.toISOString().slice(0, 10);
}

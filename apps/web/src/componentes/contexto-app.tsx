'use client';

import type { ItemMenu, Papel, UnidadeResumo, UsuarioSessao } from '@pente-fino/shared';
import { createContext, use } from 'react';
import type { UnidadeAtiva } from '@/lib/sessao';

export interface ContextoApp {
  usuario: UsuarioSessao;
  unidades: UnidadeResumo[];
  unidadeAtiva: UnidadeAtiva;
  /** Papéis que valem na unidade ativa. */
  papeis: Papel[];
  menu: ItemMenu[];
  /** Pode trocar de unidade (tem mais de uma opção)? */
  podeTrocarUnidade: boolean;
}

export const Contexto = createContext<ContextoApp | null>(null);

export function useApp(): ContextoApp {
  const c = use(Contexto);
  if (!c) throw new Error('useApp fora da casca do app');
  return c;
}

export function nomeDaUnidade(c: Pick<ContextoApp, 'unidades' | 'unidadeAtiva'>): string {
  if (c.unidadeAtiva === 'todas') return 'Todas as unidades';
  return c.unidades.find((u) => u.id === c.unidadeAtiva)?.nome ?? 'Unidade';
}

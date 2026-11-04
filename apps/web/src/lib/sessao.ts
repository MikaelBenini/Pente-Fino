'use client';

import {
  papeisNaUnidade,
  type Papel,
  type UnidadeResumo,
  type UsuarioSessao,
} from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { api } from './api';

export function useUsuario() {
  return useQuery({
    queryKey: ['auth', 'eu'],
    queryFn: () => api<UsuarioSessao>('auth/eu'),
    staleTime: 5 * 60_000,
  });
}

export function useUnidades(habilitado = true) {
  return useQuery({
    queryKey: ['unidades'],
    queryFn: () => api<UnidadeResumo[]>('unidades'),
    staleTime: 5 * 60_000,
    enabled: habilitado,
  });
}

// ─── Unidade ativa (por aparelho) ─────────────────────────────────────────

/** "todas" = visão da rede (só para quem tem papel na conta inteira). */
export type UnidadeAtiva = string | 'todas';

const CHAVE = 'pf-unidade';
const ouvintes = new Set<() => void>();

function lerUnidade(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function escolherUnidade(valor: UnidadeAtiva) {
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {
    // Sem armazenamento (aba anônima restrita): vale até recarregar.
  }
  ouvintes.forEach((o) => o());
}

export function useUnidadeGuardada(): string | null {
  return useSyncExternalStore(
    useCallback((o: () => void) => {
      ouvintes.add(o);
      window.addEventListener('storage', o);
      return () => {
        ouvintes.delete(o);
        window.removeEventListener('storage', o);
      };
    }, []),
    lerUnidade,
    () => null,
  );
}

/**
 * Decide a unidade ativa a partir do que está guardado e do que o usuário alcança.
 * null = precisa escolher (tela /unidade).
 */
export function resolverUnidade(
  usuario: UsuarioSessao,
  unidades: UnidadeResumo[],
  guardada: string | null,
): UnidadeAtiva | null {
  const naConta = usuario.papeis.some((p) => p.unidadeId === null);
  if (guardada === 'todas' && naConta) return 'todas';
  if (guardada && unidades.some((u) => u.id === guardada)) return guardada;
  if (naConta) return 'todas';
  if (unidades.length === 1) return unidades[0]!.id;
  return null;
}

/** Papéis que valem na unidade ativa (menu e permissões da tela). */
export function papeisAtivos(usuario: UsuarioSessao, unidade: UnidadeAtiva): Papel[] {
  if (unidade === 'todas')
    return [...new Set(usuario.papeis.filter((p) => p.unidadeId === null).map((p) => p.papel))];
  return papeisNaUnidade(usuario.papeis, unidade);
}

export const NOME_PAPEL: Record<Papel, string> = {
  dono: 'Dono',
  gestor: 'Gestor',
  recepcao: 'Recepção',
  barbeiro: 'Barbeiro',
};

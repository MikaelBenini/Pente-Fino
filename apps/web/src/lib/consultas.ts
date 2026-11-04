'use client';

import type {
  DiaCalendario,
  ProfissionalDetalhe,
  ServicoDetalhe,
  TabelaPrecos,
  UnidadeDetalhe,
  UsuarioEquipe,
} from '@pente-fino/shared';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from './api';

export interface ContaResumo {
  id: string;
  nome: string;
  plano: 'basico' | 'pro' | 'premium';
  status: string;
  uso: { unidades: number; profissionais: number };
  limites: { unidades: number | null; profissionais: number | null };
}

export const chaves = {
  conta: ['conta'] as const,
  unidades: ['unidades'] as const,
  calendario: (unidadeId: string, de: string, ate: string) =>
    ['calendario', unidadeId, de, ate] as const,
  usuarios: ['usuarios'] as const,
  servicos: ['servicos'] as const,
  precos: ['precos'] as const,
  profissionais: ['profissionais'] as const,
};

export const useConta = () =>
  useQuery({ queryKey: chaves.conta, queryFn: () => api<ContaResumo>('conta') });
export const useUnidadesDetalhe = () =>
  useQuery({ queryKey: chaves.unidades, queryFn: () => api<UnidadeDetalhe[]>('unidades') });
export const useUsuariosEquipe = () =>
  useQuery({ queryKey: chaves.usuarios, queryFn: () => api<UsuarioEquipe[]>('usuarios') });
export const useServicos = () =>
  useQuery({ queryKey: chaves.servicos, queryFn: () => api<ServicoDetalhe[]>('servicos') });
export const usePrecos = () =>
  useQuery({ queryKey: chaves.precos, queryFn: () => api<TabelaPrecos>('precos') });
export const useProfissionais = () =>
  useQuery({
    queryKey: chaves.profissionais,
    queryFn: () => api<ProfissionalDetalhe[]>('profissionais'),
  });

export function useCalendario(unidadeId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: chaves.calendario(unidadeId ?? '', de, ate),
    queryFn: () => api<DiaCalendario[]>(`unidades/${unidadeId}/calendario?de=${de}&ate=${ate}`),
    enabled: !!unidadeId,
  });
}

/** Mutação que, ao dar certo, atualiza as listas afetadas. */
export function useAcao<E, S>(fn: (entrada: E) => Promise<S>, invalidar: QueryKey[]) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(invalidar.map((queryKey) => cliente.invalidateQueries({ queryKey })));
    },
  });
}

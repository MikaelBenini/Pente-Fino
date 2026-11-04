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
import type {
  DespesaDetalhe,
  DesempenhoBarbeiro,
  ExtratoComissao,
  MetaDetalhe,
  PainelBarbeiro,
  RespostaIndicadores,
  RespostaLucratividade,
  ResumoComissao,
} from '@pente-fino/shared';

import type {
  Agenda,
  CaixaDia,
  ClienteDetalhe,
  ClienteResumo,
  ComandaDetalhe,
  ComandaResumo,
  HorarioLivre,
  ProdutoDetalhe,
} from '@pente-fino/shared';

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

// ─── Operação (6B) ────────────────────────────────────────────────────────

export const chavesOperacao = {
  clientes: ['clientes'] as const,
  agenda: ['agenda'] as const,
  comandas: ['comandas'] as const,
  caixa: ['caixa'] as const,
  produtos: ['produtos'] as const,
};

export const useProdutos = () =>
  useQuery({ queryKey: chavesOperacao.produtos, queryFn: () => api<ProdutoDetalhe[]>('produtos') });

export function useClientes(busca: string) {
  return useQuery({
    queryKey: [...chavesOperacao.clientes, 'lista', busca],
    queryFn: () => api<ClienteResumo[]>(`clientes?busca=${encodeURIComponent(busca)}`),
    placeholderData: (anterior) => anterior,
  });
}

export function useCliente(id: string | null) {
  return useQuery({
    queryKey: [...chavesOperacao.clientes, id],
    queryFn: () => api<ClienteDetalhe>(`clientes/${id}`),
    enabled: !!id,
  });
}

export function useAgenda(unidadeId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesOperacao.agenda, unidadeId, de, ate],
    queryFn: () => api<Agenda>(`agenda?unidadeId=${unidadeId}&de=${de}&ate=${ate}`),
    enabled: !!unidadeId,
    refetchInterval: 60_000,
  });
}

export function useLivres(
  unidadeId: string | null,
  data: string,
  duracaoMin: number,
  profissionalId?: string,
) {
  return useQuery({
    queryKey: [...chavesOperacao.agenda, 'livres', unidadeId, data, duracaoMin, profissionalId],
    queryFn: () =>
      api<HorarioLivre[]>(
        `agenda/horarios-livres?unidadeId=${unidadeId}&data=${data}&duracaoMin=${duracaoMin}${profissionalId ? `&profissionalId=${profissionalId}` : ''}`,
      ),
    enabled: !!unidadeId && !!data && duracaoMin > 0,
  });
}

export function useComandas(unidadeId: string | null, data: string) {
  return useQuery({
    queryKey: [...chavesOperacao.comandas, unidadeId, data],
    queryFn: () =>
      api<ComandaResumo[]>(`comandas?data=${data}${unidadeId ? `&unidadeId=${unidadeId}` : ''}`),
    refetchInterval: 30_000,
  });
}

export function useComanda(id: string | null) {
  return useQuery({
    queryKey: [...chavesOperacao.comandas, 'detalhe', id],
    queryFn: () => api<ComandaDetalhe>(`comandas/${id}`),
    enabled: !!id,
  });
}

export function useCaixa(unidadeId: string | null, data: string) {
  return useQuery({
    queryKey: [...chavesOperacao.caixa, unidadeId, data],
    queryFn: () => api<CaixaDia>(`caixa?unidadeId=${unidadeId}&data=${data}`),
    enabled: !!unidadeId,
  });
}

/** Tudo que muda quando uma comanda muda. */
export const INVALIDAR_OPERACAO = [
  chavesOperacao.comandas,
  chavesOperacao.agenda,
  chavesOperacao.caixa,
  chavesOperacao.clientes,
];

// ─── Resultados (6C) ──────────────────────────────────────────────────────

export const chavesResultados = {
  indicadores: ['indicadores'] as const,
  despesas: ['despesas'] as const,
  comissoes: ['comissoes'] as const,
  metas: ['metas'] as const,
  me: ['me'] as const,
};

const comUnidade = (unidade: string | null) =>
  unidade && unidade !== 'todas' ? `&unidadeId=${unidade}` : '';

export function useIndicadores(unidade: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.indicadores, unidade, de, ate],
    queryFn: () =>
      api<RespostaIndicadores>(`indicadores?de=${de}&ate=${ate}${comUnidade(unidade)}`),
  });
}

export function useLucratividade(unidade: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.indicadores, 'lucro', unidade, de, ate],
    queryFn: () =>
      api<RespostaLucratividade>(`lucratividade?de=${de}&ate=${ate}${comUnidade(unidade)}`),
  });
}

export function useMetas(unidade: string | null, mes: string) {
  return useQuery({
    queryKey: [...chavesResultados.metas, unidade, mes],
    queryFn: () => api<MetaDetalhe[]>(`metas?mes=${mes}${comUnidade(unidade)}`),
  });
}

export function useDespesas(unidade: string | null, mes: string) {
  return useQuery({
    queryKey: [...chavesResultados.despesas, unidade, mes],
    queryFn: () => api<DespesaDetalhe[]>(`despesas?mes=${mes}${comUnidade(unidade)}`),
  });
}

export const useCategoriasDespesa = () =>
  useQuery({
    queryKey: [...chavesResultados.despesas, 'categorias'],
    queryFn: () =>
      api<{ id: string; nome: string; grupo: DespesaDetalhe['grupo'] }[]>('categorias-despesa'),
  });

export function useResumoComissoes(unidade: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.comissoes, unidade, de, ate],
    queryFn: () => api<ResumoComissao[]>(`comissoes?de=${de}&ate=${ate}${comUnidade(unidade)}`),
  });
}

export function useExtrato(profissionalId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.comissoes, 'extrato', profissionalId, de, ate],
    queryFn: () => api<ExtratoComissao>(`comissoes/${profissionalId}/extrato?de=${de}&ate=${ate}`),
    enabled: !!profissionalId,
  });
}

export const useMeHoje = () =>
  useQuery({
    queryKey: [...chavesResultados.me, 'hoje'],
    queryFn: () => api<PainelBarbeiro>('me/hoje'),
    refetchInterval: 60_000,
  });
export const useMeDesempenho = (mes: string) =>
  useQuery({
    queryKey: [...chavesResultados.me, 'desempenho', mes],
    queryFn: () => api<DesempenhoBarbeiro>(`me/desempenho?mes=${mes}`),
  });
export const useMeComissoes = (de: string, ate: string) =>
  useQuery({
    queryKey: [...chavesResultados.me, 'comissoes', de, ate],
    queryFn: () => api<ExtratoComissao[]>(`me/comissoes?de=${de}&ate=${ate}`),
  });

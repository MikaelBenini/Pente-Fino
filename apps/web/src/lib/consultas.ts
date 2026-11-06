'use client';

import type {
  OcupacaoDaUnidade,
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
  AssinaturaDetalhe,
  ConexaoBot,
  EstadoAssinatura,
  EnvioParaCliente,
  EstadoBot,
  ListaConversas,
  MensagemDoCliente,
  ResumoDoDia,
  ResumoDoMes,
  FichaProfissional,
  LinhaRankingEquipe,
  DespesaDetalhe,
  DesempenhoBarbeiro,
  ExtratoComissao,
  MetaDetalhe,
  PainelBarbeiro,
  RespostaIndicadores,
  RespostaLucratividade,
  LinhaCanal,
  ResumoAvaliacoes,
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
  ciclo: 'mensal' | 'anual';
  status: string;
  /** Fim do teste grátis (ISO), quando a conta está em teste. */
  testeAte: string | null;
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
  desempenho: ['desempenho'] as const,
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

/** Ficha do profissional (dono, gestor da unidade ou o próprio barbeiro). */
export const useFichaProfissional = (id: string | null, de: string, ate: string) =>
  useQuery({
    queryKey: [...chavesResultados.desempenho, 'ficha', id, de, ate],
    queryFn: () => api<FichaProfissional>(`profissionais/${id}/desempenho?de=${de}&ate=${ate}`),
    enabled: !!id,
  });

/** Ranking da equipe no período; unidade ativa ou a rede inteira. */
export const useRankingEquipe = (unidade: string | null, de: string, ate: string) =>
  useQuery({
    queryKey: [...chavesResultados.desempenho, 'ranking', unidade, de, ate],
    queryFn: () =>
      api<LinhaRankingEquipe[]>(
        `profissionais/desempenho?de=${de}&ate=${ate}${comUnidade(unidade)}`,
      ),
  });

const comProfissional = (id: string | null) => (id ? `&profissionalId=${id}` : '');

/** O que tem para o dia e o que já foi feito; atualiza sozinho a cada minuto. */
export const useResumoDia = (unidade: string | null, data: string, profissional: string | null) =>
  useQuery({
    queryKey: [...chavesResultados.desempenho, 'dia', unidade, data, profissional],
    queryFn: () =>
      api<ResumoDoDia>(
        `resumo/dia?data=${data}${comUnidade(unidade)}${comProfissional(profissional)}`,
      ),
    refetchInterval: 60_000,
  });

export const useResumoMes = (unidade: string | null, mes: string, profissional: string | null) =>
  useQuery({
    queryKey: [...chavesResultados.desempenho, 'mes', unidade, mes, profissional],
    queryFn: () =>
      api<ResumoDoMes>(
        `resumo/mes?mes=${mes}${comUnidade(unidade)}${comProfissional(profissional)}`,
      ),
  });

export const chaveBot = ['bot'] as const;
/** Menu publicado e rascunho, mensagens prontas e horário das unidades. */
export const useBot = (ativo = true) =>
  useQuery({ queryKey: chaveBot, queryFn: () => api<EstadoBot>('bot'), enabled: ativo });

/** Conexão do WhatsApp da unidade. Enquanto espera a leitura do QR, consulta a cada 3 s. */
export const useConexaoBot = (unidadeId: string, ativo: boolean) =>
  useQuery({
    queryKey: [...chaveBot, 'conexao', unidadeId],
    queryFn: () => api<ConexaoBot>(`bot/conexao/${unidadeId}`),
    enabled: ativo,
    refetchInterval: (q) => (q.state.data?.status === 'aguardando_qr' ? 3_000 : false),
  });

/** Conversa do WhatsApp com o cliente (recepção, gestor e dono). */
export const useMensagensCliente = (clienteId: string | null, ativo: boolean) =>
  useQuery({
    queryKey: [...chavesOperacao.clientes, clienteId, 'mensagens'],
    queryFn: () => api<MensagemDoCliente[]>(`clientes/${clienteId}/mensagens`),
    enabled: !!clienteId && ativo,
  });

// ─── Conversas do bot (recepção, gestor e dono) ───────────────────────────

export const chaveConversas = ['conversas'] as const;

/** Lista da unidade; consulta a cada 15 s para a fila de quem espera atendente andar sozinha. */
export const useConversas = (unidade: string, ativo = true) =>
  useQuery({
    queryKey: [...chaveConversas, 'lista', unidade],
    queryFn: () =>
      api<ListaConversas>(`conversas${unidade !== 'todas' ? `?unidadeId=${unidade}` : ''}`),
    enabled: ativo,
    refetchInterval: 15_000,
  });

/** Mensagens da conversa aberta, a cada 5 s (a resposta do cliente aparece sem recarregar). */
export const useMensagensConversa = (id: string | null) =>
  useQuery({
    queryKey: [...chaveConversas, 'mensagens', id],
    queryFn: () => api<MensagemDoCliente[]>(`conversas/${id}/mensagens`),
    enabled: !!id,
    refetchInterval: 5_000,
  });

/** Dá para mandar pelo número da barbearia? Consulta só com a janela aberta. */
export const useEnvioParaCliente = (clienteId: string, ativo: boolean) =>
  useQuery({
    queryKey: [...chaveConversas, 'cliente', clienteId],
    queryFn: () => api<EnvioParaCliente>(`conversas/cliente/${clienteId}`),
    enabled: ativo,
  });

/** Avaliações da barbearia no período (dono e gestor). */
export function useAvaliacoes(unidade: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.indicadores, 'avaliacoes', unidade, de, ate],
    queryFn: () => api<ResumoAvaliacoes>(`avaliacoes?de=${de}&ate=${ate}${comUnidade(unidade)}`),
  });
}

// ─── Assinatura do Pente Fino ─────────────────────────────────────────────

export const chaveAssinatura = ['assinatura'] as const;

/** Situação da conta para o aviso do painel (todos os papéis); revê a cada 5 minutos. */
export const useSituacaoConta = () =>
  useQuery({
    queryKey: [...chaveAssinatura, 'situacao'],
    queryFn: () => api<EstadoAssinatura>('conta/situacao'),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

/** Aba Assinatura (só o dono). */
export const useAssinatura = (ativo: boolean) =>
  useQuery({
    queryKey: [...chaveAssinatura, 'detalhe'],
    queryFn: () => api<AssinaturaDetalhe>('conta/assinatura'),
    enabled: ativo,
  });

/** Por onde os clientes marcam (dono e gestor). */
export function useCanais(unidade: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.indicadores, 'canais', unidade, de, ate],
    queryFn: () => api<LinhaCanal[]>(`canais?de=${de}&ate=${ate}${comUnidade(unidade)}`),
  });
}

/** Ocupação de uma unidade (cadeiras × expediente) no período; só conta até hoje. */
export function useOcupacao(unidadeId: string | null, de: string, ate: string) {
  return useQuery({
    queryKey: [...chavesResultados.indicadores, 'ocupacao', unidadeId, de, ate],
    queryFn: () => api<OcupacaoDaUnidade>(`ocupacao?unidadeId=${unidadeId}&de=${de}&ate=${ate}`),
    enabled: !!unidadeId,
  });
}

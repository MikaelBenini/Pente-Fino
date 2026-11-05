// Esquemas da Etapa 6C: despesas, comissões, metas e indicadores.
import { z } from 'zod';
import type { Indicadores, LucroProduto, LucroServico, Projecao } from './indicadores.js';
import type { AgendaItem } from './esquemas-operacao.js';

const uuid = (rotulo: string) => z.uuid({ error: `${rotulo} inválido.` });
const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida (use AAAA-MM-DD).' });
const mesIso = z.string().regex(/^\d{4}-\d{2}$/, { error: 'Mês inválido (use AAAA-MM).' });
const centavos = z.number({ error: 'Informe o valor.' }).int().min(0).max(1_000_000_000);

export const GRUPOS_DESPESA = [
  'fixa',
  'variavel',
  'manutencao',
  'investimento',
  'retirada_dono',
  'cartao_resgate',
] as const;
export const NOME_GRUPO_DESPESA: Record<(typeof GRUPOS_DESPESA)[number], string> = {
  fixa: 'Fixa',
  variavel: 'Variável',
  manutencao: 'Manutenção',
  investimento: 'Investimento',
  retirada_dono: 'Retirada do dono',
  cartao_resgate: 'Cartão e resgates',
};
/** Ficam fora do % de despesas operacionais. */
export const GRUPOS_FORA_OPERACIONAL = ['investimento', 'retirada_dono', 'cartao_resgate'] as const;

export const periodoSchema = z
  .object({ de: dataIso, ate: dataIso, unidadeId: uuid('Unidade').optional() })
  .refine((p) => p.de <= p.ate, { error: 'O início precisa ser antes do fim.', path: ['ate'] });

export const despesaSchema = z.object({
  unidadeId: uuid('Unidade').nullable(),
  categoriaId: uuid('Categoria'),
  descricao: z.string().trim().min(2, { error: 'Descreva a despesa.' }).max(120),
  valor: centavos.min(1, { error: 'O valor precisa ser maior que zero.' }),
  competencia: mesIso,
  vencimento: dataIso.nullable().optional(),
  pago: z.boolean().default(false),
});
export type DespesaEntrada = z.infer<typeof despesaSchema>;

export const categoriaDespesaSchema = z.object({
  nome: z.string().trim().min(2).max(60),
  grupo: z.enum(GRUPOS_DESPESA),
});

export interface DespesaDetalhe {
  id: string;
  unidadeId: string | null;
  categoriaId: string;
  categoria: string;
  grupo: (typeof GRUPOS_DESPESA)[number];
  descricao: string;
  valor: number;
  competencia: string;
  vencimento: string | null;
  pago: boolean;
}

export const pagamentoComissaoSchema = z
  .object({
    profissionalId: uuid('Profissional'),
    periodoInicio: dataIso,
    periodoFim: dataIso,
    valor: centavos.min(1, { error: 'O valor precisa ser maior que zero.' }),
  })
  .refine((p) => p.periodoInicio <= p.periodoFim, {
    error: 'Período inválido.',
    path: ['periodoFim'],
  });
export type PagamentoComissaoEntrada = z.infer<typeof pagamentoComissaoSchema>;

export interface ResumoComissao {
  profissionalId: string;
  nome: string;
  unidadeId: string;
  /** Comandas ainda abertas, estimado pela regra vigente. */
  previsto: number;
  /** Comissão de comandas fechadas no período. */
  fechado: number;
  pago: number;
  aReceber: number;
}

export interface ExtratoComissao {
  resumo: ResumoComissao;
  itens: {
    comandaId: string;
    fechadaEm: string;
    cliente: string | null;
    descricao: string;
    valor: number;
    comissao: number;
  }[];
  pagamentos: {
    id: string;
    periodoInicio: string;
    periodoFim: string;
    valor: number;
    pagoEm: string;
  }[];
}

export const metaSchema = z
  .object({
    unidadeId: uuid('Unidade'),
    mes: mesIso,
    tipo: z.enum(['faturamento', 'servico']),
    servicoId: uuid('Serviço').nullable().default(null),
    objetivo: z
      .number()
      .int()
      .min(1, { error: 'Defina um objetivo maior que zero.' })
      .max(1_000_000_000),
  })
  .refine((m) => (m.tipo === 'servico') === (m.servicoId !== null), {
    error: 'Meta de serviço precisa do serviço.',
    path: ['servicoId'],
  });
export type MetaEntrada = z.infer<typeof metaSchema>;

export interface MetaDetalhe {
  id: string;
  unidadeId: string;
  mes: string;
  tipo: 'faturamento' | 'servico';
  servicoId: string | null;
  servico: string | null;
  objetivo: number;
  /** Calculado das comandas fechadas, nunca guardado. */
  atual: number;
  fracaoDoMes: number;
}

export interface RespostaIndicadores {
  de: string;
  ate: string;
  atual: Indicadores;
  anterior: Indicadores;
  /** Só quando o período é o mês corrente. */
  projecao: Projecao | null;
}

export interface RespostaLucratividade {
  servicos: (LucroServico & { nome: string })[];
  produtos: (LucroProduto & { nome: string })[];
}

export interface PainelBarbeiro {
  hoje: string;
  agenda: AgendaItem[];
  comissaoDia: number;
  comissaoMes: number;
  metas: MetaDetalhe[];
}

export interface DesempenhoBarbeiro {
  mes: string;
  atual: {
    faturamento: number;
    clientes: number;
    ticketMedio: number;
    extrasQuantidade: number;
    percentualExtras: number;
    comissao: number;
    atendimentos: number;
  };
  anterior: DesempenhoBarbeiro['atual'];
}

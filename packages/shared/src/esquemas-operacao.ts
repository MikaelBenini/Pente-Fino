// Esquemas de entrada da operação (Etapa 6B): clientes, agenda, comanda e caixa.
import { z } from 'zod';
import type { StatusComanda } from './comanda.js';

const uuid = (rotulo: string) => z.uuid({ error: `${rotulo} inválido.` });
const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida (use AAAA-MM-DD).' });
const centavos = z.number({ error: 'Informe o valor.' }).int().min(0).max(100_000_000);
const telefone = z
  .string()
  .transform((t) => t.replace(/\D/g, ''))
  .transform((d) => (d === '' ? null : d.length === 10 || d.length === 11 ? `55${d}` : d))
  .pipe(
    z
      .string()
      .regex(/^\d{12,13}$/, { error: 'Telefone inválido: informe DDD e número.' })
      .nullable(),
  );

// ─── Clientes ─────────────────────────────────────────────────────────────

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome do cliente.' }).max(120),
  telefone: telefone.optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === '' ? null : v))
    .pipe(z.email({ error: 'E-mail inválido.' }).nullable())
    .optional(),
  aniversario: dataIso.nullable().optional(),
  origemLead: z.string().trim().max(40).nullable().optional(),
  consentimentoMsg: z.boolean().optional(),
});
export type ClienteEntrada = z.infer<typeof clienteSchema>;

export const notaClienteSchema = z.object({
  texto: z.string().trim().min(2, { error: 'Escreva a anotação.' }).max(1000),
});

export const buscaClientesSchema = z.object({
  busca: z.string().trim().max(80).optional(),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
});

export interface ClienteResumo {
  id: string;
  nome: string;
  /** null quando oculto para o barbeiro. */
  telefone: string | null;
  email: string | null;
  aniversario: string | null;
  ultimaVisita: string | null;
  visitas: number;
}

export interface ClienteDetalhe extends ClienteResumo {
  origemLead: string | null;
  consentimentoMsg: boolean;
  /** Quando o cliente escolheu (pelo WhatsApp ou no cadastro). */
  consentimentoEm: string | null;
  telefoneOculto: boolean;
  notas: { id: string; texto: string; autor: string | null; criadoEm: string }[];
  historico: {
    comandaId: string;
    fechadaEm: string;
    unidade: string;
    profissional: string;
    servicos: string[];
    total: number;
  }[];
}

// ─── Agenda ───────────────────────────────────────────────────────────────

const clienteNovoSchema = z.object({
  nome: clienteSchema.shape.nome,
  telefone: telefone.optional(),
});

export const novoAgendamentoSchema = z
  .object({
    unidadeId: uuid('Unidade'),
    profissionalId: uuid('Profissional'),
    clienteId: uuid('Cliente').optional(),
    clienteNovo: clienteNovoSchema.optional(),
    inicio: z.iso.datetime({ offset: true, error: 'Horário inválido.' }),
    servicoIds: z
      .array(uuid('Serviço'))
      .min(1, { error: 'Escolha pelo menos um serviço.' })
      .max(10),
    origem: z.enum(['balcao', 'bot', 'app', 'link']).default('balcao'),
    observacao: z.string().trim().max(300).optional(),
    /** Encaixe: qualquer horário, mesmo fora da grade (só a recepção). */
    encaixe: z.boolean().default(false),
    /** A recepção viu os avisos do encaixe e confirmou. */
    confirmarEncaixe: z.boolean().default(false),
  })
  .refine((d) => d.clienteId || d.clienteNovo, {
    error: 'Escolha o cliente ou cadastre um novo.',
    path: ['clienteId'],
  });
export type NovoAgendamentoEntrada = z.infer<typeof novoAgendamentoSchema>;

export const remarcarSchema = z.object({
  inicio: z.iso.datetime({ offset: true, error: 'Horário inválido.' }),
  profissionalId: uuid('Profissional').optional(),
  /** Mudou o horário: avisa, salvo false (o desfazer). Mudou só o barbeiro: avisa se true. */
  avisarCliente: z.boolean().optional(),
});

export const cancelarSchema = z.object({
  motivo: z.string().trim().min(3, { error: 'Diga o motivo.' }).max(200),
  falta: z.boolean().default(false),
  /** Cancelado pela barbearia (não falta): manda o aviso ao cliente pelo WhatsApp. */
  avisarCliente: z.boolean().default(false),
});

export const consultaAgendaSchema = z.object({
  unidadeId: uuid('Unidade'),
  de: dataIso,
  ate: dataIso,
});

export const consultaLivresSchema = z.object({
  unidadeId: uuid('Unidade'),
  data: dataIso,
  duracaoMin: z.coerce.number().int().min(5).max(600),
  profissionalId: uuid('Profissional').optional(),
});

export interface AgendaItem {
  agendamentoId: string;
  comandaId: string | null;
  profissionalId: string;
  cliente: string;
  servicos: string[];
  inicio: string;
  fim: string;
  status: StatusComanda;
  origem: string;
  /** O cliente respondeu "Confirmo" ao lembrete do WhatsApp. */
  confirmado: boolean;
  /** Passou da tolerância sem começar: "Cliente não chegou?". */
  atrasado: boolean;
}

export interface AgendaProfissional {
  id: string;
  nome: string;
  horarios: { diaSemana: number; inicioMin: number; fimMin: number }[];
}

export interface Agenda {
  profissionais: AgendaProfissional[];
  itens: AgendaItem[];
  bloqueios: {
    id: string;
    profissionalId: string;
    inicio: string;
    fim: string;
    motivo: string | null;
    /** Vem de um bloqueio que repete toda semana (o id é o dele). */
    recorrente?: boolean;
  }[];
  /** Dias fechados da unidade no período. */
  fechados: string[];
  diasTrabalho: number[];
}

export interface HorarioLivre {
  profissionalId: string;
  inicios: string[];
}

// ─── Comanda ──────────────────────────────────────────────────────────────

export const novaComandaSchema = z
  .object({
    unidadeId: uuid('Unidade'),
    profissionalId: uuid('Profissional'),
    clienteId: uuid('Cliente').optional(),
    clienteNovo: clienteNovoSchema.optional(),
    servicoIds: z.array(uuid('Serviço')).max(10).default([]),
  })
  .refine((d) => d.clienteId || d.clienteNovo, {
    error: 'Escolha o cliente ou cadastre um novo.',
    path: ['clienteId'],
  });
export type NovaComandaEntrada = z.infer<typeof novaComandaSchema>;

export const novoItemSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('servico'),
    servicoId: uuid('Serviço'),
    quantidade: z.number().int().min(1).max(20).default(1),
  }),
  z.object({
    tipo: z.literal('produto'),
    produtoId: uuid('Produto'),
    quantidade: z.number().int().min(1).max(50).default(1),
  }),
  z.object({
    tipo: z.literal('nao_operacional'),
    descricao: z.string().trim().min(2).max(120),
    valor: centavos.min(1),
  }),
]);
export type NovoItemEntrada = z.infer<typeof novoItemSchema>;

export const alterarItemSchema = z.object({
  quantidade: z.number().int().min(1).max(50).optional(),
  desconto: centavos.optional(),
  /** Cliente trocou de serviço na cadeira. */
  servicoId: uuid('Serviço').optional(),
});

export const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'debito', 'credito'] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number] | 'clube';
export const NOME_FORMA: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  clube: 'Clube',
};

export const fecharComandaSchema = z.object({
  /** Desconto dado no balcão, rateado entre os itens. */
  desconto: centavos.default(0),
  pagamentos: z
    .array(
      z.object({
        forma: z.enum(FORMAS_PAGAMENTO),
        valor: centavos.min(1, { error: 'Valor precisa ser maior que zero.' }),
      }),
    )
    .max(FORMAS_PAGAMENTO.length)
    // Cada forma uma vez: dois cartões de crédito somam na mesma linha.
    .refine((ps) => new Set(ps.map((p) => p.forma)).size === ps.length, {
      error: 'Cada forma de pagamento aparece uma vez só; some os valores na mesma linha.',
    }),
});
export type FecharComandaEntrada = z.infer<typeof fecharComandaSchema>;

export const reabrirSchema = z.object({
  motivo: z.string().trim().min(5, { error: 'Explique o motivo (fica registrado).' }).max(300),
});

export const consultaComandasSchema = z.object({
  unidadeId: uuid('Unidade').optional(),
  data: dataIso.optional(),
  status: z.string().max(80).optional(),
});

export interface ItemComandaDetalhe {
  id: string;
  tipo: 'servico' | 'produto' | 'nao_operacional';
  servicoId: string | null;
  produtoId: string | null;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
  ehExtra: boolean;
  /** Coberto pelo plano do clube: entra com valor zero e conta no uso do mês. */
  cobertoClube: boolean;
  comissaoValor: number;
}

export interface ComandaResumo {
  id: string;
  unidadeId: string;
  profissionalId: string;
  profissional: string;
  cliente: string | null;
  clienteId: string | null;
  status: StatusComanda;
  inicio: string | null;
  fim: string | null;
  totalLiquido: number;
  servicos: string[];
}

export interface ComandaDetalhe extends ComandaResumo {
  agendamentoId: string | null;
  totalBruto: number;
  desconto: number;
  itens: ItemComandaDetalhe[];
  pagamentos: { forma: FormaPagamento; valor: number }[];
  fechadaEm: string | null;
  motivoCancelamento: string | null;
  /** Passou da tolerância sem começar: mostra "Cliente não chegou?" (Chegou / Não veio). */
  atrasado: boolean;
  /** "Não veio" por atraso há menos de 5 min: ainda dá para desfazer. */
  podeDesfazerNaoVeio: boolean;
}

// ─── Produtos ─────────────────────────────────────────────────────────────

export const produtoSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome do produto.' }).max(80),
  categoria: z.string().trim().max(40).nullable().optional(),
  precoVenda: centavos,
  custo: centavos,
  ativo: z.boolean().default(true),
});
export type ProdutoEntrada = z.infer<typeof produtoSchema>;
export interface ProdutoDetalhe extends ProdutoEntrada {
  id: string;
}

// ─── Caixa ────────────────────────────────────────────────────────────────

export const abrirCaixaSchema = z.object({
  unidadeId: uuid('Unidade'),
  data: dataIso,
  valorAbertura: centavos,
});
export const fecharCaixaSchema = z.object({
  unidadeId: uuid('Unidade'),
  data: dataIso,
  /** Contagem do dinheiro na gaveta (troco inicial + recebido em dinheiro). */
  totalInformado: centavos,
});

export interface CaixaDia {
  unidadeId: string;
  data: string;
  situacao: 'nao_aberto' | 'aberto' | 'fechado';
  valorAbertura: number;
  porForma: { forma: FormaPagamento; total: number; quantidade: number }[];
  totalRecebido: number;
  /** Troco + dinheiro recebido: o que deve estar na gaveta. */
  dinheiroEsperado: number;
  totalInformado: number | null;
  divergencia: number | null;
  aReceber: { quantidade: number; total: number };
  fechadas: number;
}

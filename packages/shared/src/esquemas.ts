// Esquemas de entrada dos cadastros (Etapa 6). Mesma validação na API e nos formulários.
import { z } from 'zod';
import { PAPEIS } from './papeis.js';

const uuid = (rotulo: string) => z.uuid({ error: `${rotulo} inválido.` });
const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida (use AAAA-MM-DD).' });
const centavos = z
  .number({ error: 'Informe o valor.' })
  .int()
  .min(0, { error: 'O valor não pode ser negativo.' })
  .max(100_000_000);
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const idSchema = z.object({ id: uuid('Identificador') });

// ─── Conta e unidades ─────────────────────────────────────────────────────

export const contaSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome da barbearia.' }).max(120),
});
export type ContaEntrada = z.infer<typeof contaSchema>;

export const unidadeSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome da unidade.' }).max(80),
  endereco: textoOpcional(200),
  telefone: z
    .string()
    .transform((t) => t.replace(/\D/g, ''))
    .transform((d) => (d === '' ? null : d.length === 10 || d.length === 11 ? `55${d}` : d))
    .pipe(
      z
        .string()
        .regex(/^\d{12,13}$/, { error: 'Telefone inválido: informe DDD e número.' })
        .nullable(),
    )
    .optional(),
  diasTrabalho: z
    .array(z.number().int().min(0).max(6))
    .min(1, { error: 'Marque pelo menos um dia de trabalho.' })
    .transform((d) => [...new Set(d)].sort()),
  capacidade: z
    .number({ error: 'Informe quantas cadeiras.' })
    .int()
    .min(1, { error: 'Pelo menos 1 cadeira.' })
    .max(50),
});
export type UnidadeEntrada = z.infer<typeof unidadeSchema>;
export const unidadeParcialSchema = unidadeSchema.partial().extend({
  ativa: z.boolean().optional(),
  /** Endereço do link público: /agendar?u=<slug>. */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      error: 'Use letras minúsculas, números e hífen (ex.: barbearia-centro).',
    })
    .min(3, { error: 'Pelo menos 3 caracteres.' })
    .max(60)
    .optional(),
  agendamentoPublico: z.boolean().optional(),
  /** Painel P4: a página da unidade aparece no Google (desligado = fica fora da busca). */
  aparecerNoGoogle: z.boolean().optional(),
});

export const diaCalendarioSchema = z.object({
  trabalha: z.boolean(),
  motivo: textoOpcional(80),
});
export type DiaCalendarioEntrada = z.infer<typeof diaCalendarioSchema>;

export interface UnidadeDetalhe {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  diasTrabalho: number[];
  capacidade: number;
  fuso: string;
  ativa: boolean;
  slug: string | null;
  agendamentoPublico: boolean;
  aparecerNoGoogle: boolean;
}

export interface DiaCalendario {
  data: string;
  trabalha: boolean;
  motivo: string | null;
}

export const NOMES_DIAS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;
export const NOMES_DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

// ─── Usuários e papéis ────────────────────────────────────────────────────

export const papeisUsuarioSchema = z.object({
  papeis: z
    .array(z.object({ papel: z.enum(PAPEIS), unidadeId: uuid('Unidade').nullable() }))
    .min(1, { error: 'O usuário precisa de pelo menos um papel.' })
    .max(20),
});
export type PapeisUsuarioEntrada = z.infer<typeof papeisUsuarioSchema>;

export const situacaoUsuarioSchema = z.object({ ativo: z.boolean() });

export interface UsuarioEquipe {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
  /** Convite ainda não aceito (sem senha). */
  pendente: boolean;
  papeis: { papel: (typeof PAPEIS)[number]; unidadeId: string | null }[];
}

// ─── Serviços e preços ────────────────────────────────────────────────────

export const servicoSchema = z.object({
  nome: z.string().trim().min(2, { error: 'Informe o nome do serviço.' }).max(80),
  categoria: textoOpcional(40),
  duracaoMin: z
    .number({ error: 'Informe a duração.' })
    .int()
    .min(5, { error: 'Mínimo de 5 minutos.' })
    .max(600),
  custoProduto: centavos,
  ehExtra: z.boolean(),
  pesoAtendimento: z.number().int().min(0).max(10),
  ativo: z.boolean().default(true),
  /** Química e afins: o valor é digitado na comanda (a tabela vira o valor sugerido). */
  precoLivre: z.boolean().default(false),
  /** Faixa do preço livre, em centavos (null = sem limite). */
  precoMinimo: centavos.nullable().default(null),
  precoMaximo: centavos.nullable().default(null),
});
export type ServicoEntrada = z.infer<typeof servicoSchema>;

export interface ServicoDetalhe extends ServicoEntrada {
  id: string;
}

/** Novos preços da tabela, todos valendo a partir da mesma data. */
export const novosPrecosSchema = z.object({
  vigenciaInicio: dataIso,
  precos: z
    .array(z.object({ servicoId: uuid('Serviço'), unidadeId: uuid('Unidade'), valor: centavos }))
    .min(1, { error: 'Nenhum preço mudou.' })
    .max(2000),
});
export type NovosPrecosEntrada = z.infer<typeof novosPrecosSchema>;

export interface PrecoVigente {
  servicoId: string;
  unidadeId: string;
  valor: number;
  vigenciaInicio: string;
}

export interface TabelaPrecos {
  data: string;
  vigentes: PrecoVigente[];
  /** Mudanças futuras já programadas. */
  programados: PrecoVigente[];
}

// ─── Profissionais ────────────────────────────────────────────────────────

const regraSchema = z
  .object({
    percentualBp: z.number().int().min(0).max(10_000).nullable(),
    valorFixo: centavos.nullable(),
  })
  .refine((r) => (r.percentualBp === null) !== (r.valorFixo === null), {
    error: 'Escolha percentual ou valor fixo.',
  });

const horarioSchema = z
  .object({
    diaSemana: z.number().int().min(0).max(6),
    inicioMin: z.number().int().min(0).max(1440),
    fimMin: z.number().int().min(0).max(1440),
  })
  .refine((h) => h.inicioMin < h.fimMin, { error: 'O fim precisa ser depois do início.' });

export const horariosSchema = z.object({ horarios: z.array(horarioSchema).max(28) });
export type HorariosEntrada = z.infer<typeof horariosSchema>;

export const novoProfissionalSchema = z
  .object({
    unidadeId: uuid('Unidade'),
    /** Usuário já cadastrado, ou dados para convidar um novo. */
    usuarioId: uuid('Usuário').optional(),
    nome: z.string().trim().min(2).max(120).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'E-mail inválido.' }))
      .optional(),
    telefone: z.string().optional(),
    dataEntrada: dataIso,
    comissaoServico: regraSchema,
    comissaoProduto: regraSchema,
  })
  .refine((d) => d.usuarioId || (d.nome && d.email), {
    error: 'Escolha alguém da equipe ou informe nome e e-mail para convidar.',
    path: ['email'],
  });
export type NovoProfissionalEntrada = z.infer<typeof novoProfissionalSchema>;

export const profissionalParcialSchema = z.object({
  dataEntrada: dataIso.optional(),
  dataSaida: dataIso.nullable().optional(),
  ativo: z.boolean().optional(),
  /** Valor fixo por mês além da comissão (salário, ajuda de custo), em centavos. */
  custoFixoMensal: z
    .number()
    .int()
    .min(0, { error: 'O valor fixo não pode ser negativo.' })
    .max(10_000_000)
    .optional(),
});

export const novaRegraComissaoSchema = z.object({
  tipoItem: z.enum(['servico', 'produto']),
  vigenciaInicio: dataIso,
  regra: regraSchema,
});
export type NovaRegraComissaoEntrada = z.infer<typeof novaRegraComissaoSchema>;

export const bloqueioSchema = z
  .object({
    inicio: z.iso.datetime({ offset: true }),
    fim: z.iso.datetime({ offset: true }),
    motivo: textoOpcional(80),
  })
  .refine((b) => new Date(b.inicio) < new Date(b.fim), {
    error: 'O fim precisa ser depois do início.',
    path: ['fim'],
  });
export type BloqueioEntrada = z.infer<typeof bloqueioSchema>;

export interface RegraComissaoDetalhe {
  id: string;
  tipoItem: 'servico' | 'produto';
  percentualBp: number | null;
  valorFixo: number | null;
  vigenciaInicio: string;
}

export interface ProfissionalDetalhe {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  pendente: boolean;
  unidadeId: string;
  dataEntrada: string;
  dataSaida: string | null;
  ativo: boolean;
  /** Valor fixo por mês (centavos); null para quem não é da gestão. */
  custoFixoMensal: number | null;
  horarios: { diaSemana: number; inicioMin: number; fimMin: number }[];
  regras: RegraComissaoDetalhe[];
}

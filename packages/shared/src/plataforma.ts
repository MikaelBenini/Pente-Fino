// Administração do sistema (Etapa 15.1): quem opera o Pente Fino, fora das contas.
import { z } from 'zod';
import type { Ciclo, PlanoConta } from './planos.js';

export const PAPEIS_PLATAFORMA = ['admin', 'vendedor'] as const;
export type PapelPlataforma = (typeof PAPEIS_PLATAFORMA)[number];
export const NOME_PAPEL_PLATAFORMA: Readonly<Record<PapelPlataforma, string>> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
};

export const entrarAdminSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'E-mail inválido.' })),
  senha: z.string().min(1, { error: 'Informe a senha.' }).max(200),
  /** Código de 6 dígitos do aplicativo autenticador (obrigatório depois de configurar). */
  codigo: z
    .string()
    .transform((c) => c.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, { error: 'O código tem 6 dígitos.' }))
    .optional(),
});
export type EntrarAdminEntrada = z.infer<typeof entrarAdminSchema>;

export interface UsuarioPlataformaSessao {
  id: string;
  nome: string;
  email: string;
  papel: PapelPlataforma;
}

/** Login em etapas: senha certa sem autenticador → configurar; com autenticador → código. */
export type RespostaEntrarAdmin =
  | { etapa: 'codigo' }
  | { etapa: 'configurar'; otpauth: string; segredo: string }
  | { etapa: 'pronto'; token: string; expiraEm: string; usuario: UsuarioPlataformaSessao };

/** Conta vista pela administração: assinatura e uso; nunca dado de cliente. */
export interface ContaNaPlataforma {
  id: string;
  nome: string;
  plano: PlanoConta;
  ciclo: Ciclo;
  status: 'teste' | 'ativa' | 'suspensa' | 'cancelada';
  criadaEm: string;
  testeAte: string | null;
  configuradaEm: string | null;
  cobrancaAutomatica: boolean;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  /** Quem da plataforma vendeu (venda presencial); null = cadastro pelo site. */
  vendedorId: string | null;
  /** O dono já criou a senha. */
  donoAtivou: boolean;
  unidades: number;
  profissionais: number;
  whatsappConectado: boolean;
  fechadas7Dias: number;
  ultimaFechadaEm: string | null;
  ultimoAcessoEm: string | null;
}

// ─── Ações numa conta (sempre com motivo, na auditoria da plataforma) ─────

const motivo = z
  .string()
  .trim()
  .min(5, { error: 'Explique o motivo (pelo menos 5 letras).' })
  .max(300);
const diaISO = z.iso.date({ error: 'Data inválida.' });

export const mudarPlanoContaSchema = z.object({
  plano: z.enum(['basico', 'pro', 'premium']),
  ciclo: z.enum(['mensal', 'anual']),
  motivo,
});
export type MudarPlanoContaEntrada = z.infer<typeof mudarPlanoContaSchema>;

/** Estender o teste ou dar cortesia: o último dia em que a conta usa sem pagar. */
export const mudarTesteContaSchema = z.object({ ate: diaISO, motivo });
export type MudarTesteContaEntrada = z.infer<typeof mudarTesteContaSchema>;

export const ACOES_SITUACAO = ['bloquear', 'desbloquear', 'cancelar'] as const;
export type AcaoSituacao = (typeof ACOES_SITUACAO)[number];
export const mudarSituacaoContaSchema = z.object({ acao: z.enum(ACOES_SITUACAO), motivo });
export type MudarSituacaoContaEntrada = z.infer<typeof mudarSituacaoContaSchema>;
/** Bloquear = suspensa (só consulta); desbloquear = ativa; cancelar = cancelada (nada se apaga). */
export const STATUS_DA_ACAO: Readonly<Record<AcaoSituacao, 'suspensa' | 'ativa' | 'cancelada'>> = {
  bloquear: 'suspensa',
  desbloquear: 'ativa',
  cancelar: 'cancelada',
};

export const FORMAS_PAGAMENTO_MANUAL = [
  'pix',
  'dinheiro',
  'cartao',
  'boleto',
  'transferencia',
] as const;
export const NOME_FORMA_MANUAL: Readonly<Record<(typeof FORMAS_PAGAMENTO_MANUAL)[number], string>> =
  {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão na maquininha',
    boleto: 'Boleto',
    transferencia: 'Transferência',
  };

export const registrarPagamentoSchema = z.object({
  /** Centavos. */
  valor: z.number().int().positive({ error: 'Informe o valor.' }),
  forma: z.enum(FORMAS_PAGAMENTO_MANUAL),
  pagoEm: diaISO,
  /** Primeiro dia que o pagamento cobre; o fim sai do ciclo da conta (mês ou ano). */
  periodoInicio: diaISO,
  comprovante: z.string().trim().max(300).nullable().default(null),
});
export type RegistrarPagamentoEntrada = z.infer<typeof registrarPagamentoSchema>;

/** Último dia coberto: um mês (ou um ano) depois do início, menos um dia. */
export function fimDoPeriodo(inicio: string, ciclo: 'mensal' | 'anual'): string {
  const [a, m, d] = inicio.split('-').map(Number) as [number, number, number];
  const meses = ciclo === 'anual' ? 12 : 1;
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDoMes = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDoMes));
  alvo.setUTCDate(alvo.getUTCDate() - 1);
  return alvo.toISOString().slice(0, 10);
}

export interface FaturaNaPlataforma {
  plano: PlanoConta;
  ciclo: Ciclo;
  valor: number;
  status: 'aberta' | 'paga' | 'recusada' | 'cancelada';
  origem: 'asaas' | 'manual';
  forma: string | null;
  vencimento: string;
  periodoInicio: string;
  periodoFim: string;
  pagaEm: string | null;
  comprovante: string | null;
}

export interface EventoDaConta {
  acao: string;
  quem: string | null;
  motivo: string | null;
  antes: unknown;
  depois: unknown;
  criadoEm: string;
}

/** Ficha da conta na administração: quem paga, a estrutura e a cobrança (sem cliente). */
export interface FichaContaPlataforma {
  id: string;
  nome: string;
  plano: PlanoConta;
  ciclo: Ciclo;
  status: ContaNaPlataforma['status'];
  criadaEm: string;
  testeAte: string | null;
  configuradaEm: string | null;
  cobrancaAutomatica: boolean;
  documento: string | null;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  donos: { nome: string; email: string; telefone: string | null }[];
  unidades: { nome: string; ativa: boolean }[];
  profissionais: number;
  faturas: FaturaNaPlataforma[];
  historico: EventoDaConta[];
}

// ─── Venda presencial ─────────────────────────────────────────────────────

export const venderContaSchema = z.object({
  barbearia: z.string().trim().min(2, { error: 'Informe o nome da barbearia.' }).max(80),
  dono: z.object({
    nome: z.string().trim().min(2, { error: 'Informe o nome do dono.' }).max(80),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: 'E-mail inválido.' })),
    /** Só dígitos com DDD; vira 55 + número para o link do WhatsApp. */
    telefone: z
      .string()
      .transform((t) => t.replace(/\D/g, ''))
      .transform((d) => (d.length === 10 || d.length === 11 ? `55${d}` : d))
      .pipe(z.string().regex(/^\d{12,13}$/, { error: 'Informe o WhatsApp com DDD.' }))
      .nullable()
      .default(null),
  }),
  plano: z.enum(['basico', 'pro', 'premium']),
  ciclo: z.enum(['mensal', 'anual']),
  /** Dias de uso antes de pagar (0 = paga hoje; o vendedor registra o pagamento em seguida). */
  diasTeste: z.number().int().min(0).max(60).default(14),
});
export type VenderContaEntrada = z.infer<typeof venderContaSchema>;

export interface VendaCriada {
  contaId: string;
  linkConvite: string;
  /** Mensagem pronta para o vendedor mandar do próprio WhatsApp (quando há telefone). */
  linkWhatsapp: string | null;
  expiraEm: string;
}

export interface VendasDoVendedor {
  vendedorId: string;
  nome: string;
  criadas: number;
  /** O dono criou a senha. */
  ativadas: number;
  /** Com ao menos uma fatura paga. */
  pagas: number;
}

/** Contas vendidas por vendedor: criadas, ativadas pelo dono e pagas (ordem: mais pagas). */
export function vendasPorVendedor(d: {
  vendedores: readonly { id: string; nome: string }[];
  contas: readonly { id: string; vendedorId: string | null; donoAtivou: boolean }[];
  contasPagas: ReadonlySet<string>;
}): VendasDoVendedor[] {
  return d.vendedores
    .map((v) => {
      const dele = d.contas.filter((c) => c.vendedorId === v.id);
      return {
        vendedorId: v.id,
        nome: v.nome,
        criadas: dele.length,
        ativadas: dele.filter((c) => c.donoAtivou).length,
        pagas: dele.filter((c) => d.contasPagas.has(c.id)).length,
      };
    })
    .sort((a, b) => b.pagas - a.pagas || b.criadas - a.criadas || a.nome.localeCompare(b.nome));
}

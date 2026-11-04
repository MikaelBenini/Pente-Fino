import { dataLocal } from './datas.js';

// Limites dos planos (CLAUDE.md e docs/, seção 7). A API aplica; a tela explica.

export const PLANOS = ['basico', 'pro', 'premium'] as const;
export type PlanoConta = (typeof PLANOS)[number];

export interface LimitesPlano {
  unidades: number;
  profissionais: number;
}

export const LIMITES_PLANO: Readonly<Record<PlanoConta, LimitesPlano>> = {
  basico: { unidades: 1, profissionais: 3 },
  pro: { unidades: 1, profissionais: 10 },
  premium: { unidades: Number.POSITIVE_INFINITY, profissionais: Number.POSITIVE_INFINITY },
};

export const NOME_PLANO: Readonly<Record<PlanoConta, string>> = {
  basico: 'Básico',
  pro: 'Pro',
  premium: 'Premium',
};

/** Mensagem quando o limite foi alcançado, ou null se ainda cabe. */
export function verificarLimite(
  plano: PlanoConta,
  recurso: keyof LimitesPlano,
  emUso: number,
): string | null {
  const limite = LIMITES_PLANO[plano][recurso];
  if (emUso < limite) return null;
  const nome =
    recurso === 'unidades' ? (limite === 1 ? 'unidade' : 'unidades') : 'profissionais ativos';
  return `O plano ${NOME_PLANO[plano]} permite ${limite} ${nome}. Para adicionar mais, mude para um plano maior.`;
}

// ─── Venda dos planos (docs/documentacao-do-produto.md, seção 7) ──────────

export const CICLOS = ['mensal', 'anual'] as const;
export type Ciclo = (typeof CICLOS)[number];

/** Data da versão dos termos e da política (mudou o texto, muda a data; o cadastro grava). */
export const VERSAO_TERMOS = '2026-11-04';

/** Dias de teste grátis, sem cartão. */
export const DIAS_TESTE = 14;
/**
 * Dias de calendário (São Paulo) entre hoje e o fim do teste: 0 = termina hoje,
 * negativo = já terminou.
 */
export function diasRestantesTeste(testeAte: Date, agora: Date): number {
  const dia = (d: Date) => Date.parse(`${dataLocal(d)}T00:00:00Z`);
  return Math.round((dia(testeAte) - dia(agora)) / 86_400_000);
}

/** Plano fundador: desconto para as primeiras barbearias, enquanto a assinatura estiver ativa. */
export const FUNDADOR = { descontoBp: 3000, vagas: 20 } as const;

export interface PrecoPlano {
  /** Centavos por mês no plano mensal. */
  mensal: number;
  /** Centavos por mês no plano anual (cobrado de uma vez). */
  anualPorMes: number;
}

export const PRECOS_PLANO: Readonly<Record<PlanoConta, PrecoPlano>> = {
  basico: { mensal: 7990, anualPorMes: 6690 },
  pro: { mensal: 14990, anualPorMes: 12490 },
  premium: { mensal: 24990, anualPorMes: 20790 },
};

/** Unidade além da primeira, só no Premium. */
export const PRECO_UNIDADE_EXTRA: PrecoPlano = { mensal: 9990, anualPorMes: 8290 };

/** Quanto a rede paga por mês no ciclo escolhido (Premium cobra a partir da 2ª unidade). */
export function precoPorMes(plano: PlanoConta, ciclo: Ciclo, unidades = 1): number {
  const chave = ciclo === 'mensal' ? 'mensal' : 'anualPorMes';
  const extras = plano === 'premium' ? Math.max(0, unidades - 1) : 0;
  return PRECOS_PLANO[plano][chave] + extras * PRECO_UNIDADE_EXTRA[chave];
}

/** Total cobrado no anual e quanto se economiza contra 12 mensalidades. */
export function resumoAnual(plano: PlanoConta, unidades = 1): { total: number; economia: number } {
  const total = precoPorMes(plano, 'anual', unidades) * 12;
  return { total, economia: precoPorMes(plano, 'mensal', unidades) * 12 - total };
}

export interface RecursoPlano {
  nome: string;
  /** Plano a partir do qual o recurso vem. */
  desde: PlanoConta;
  /** false = ainda em construção; a página de vendas mostra "em breve". */
  disponivel: boolean;
}

/** O que cada plano destrava, na ordem da página de vendas. */
export const RECURSOS_PLANO: readonly RecursoPlano[] = [
  {
    nome: 'Agenda por profissional e link de agendamento online',
    desde: 'basico',
    disponivel: true,
  },
  { nome: 'Comanda automática: agendou, a comanda já existe', desde: 'basico', disponivel: true },
  { nome: 'Caixa do dia com divergência', desde: 'basico', disponivel: true },
  { nome: 'Despesas por grupo e % sobre o faturamento', desde: 'basico', disponivel: true },
  { nome: 'Indicadores: faturamento, clientes, ticket, extras', desde: 'basico', disponivel: true },
  { nome: 'App do barbeiro no celular, funciona sem internet', desde: 'basico', disponivel: true },
  { nome: 'Comanda impressa em PDF com QR code', desde: 'basico', disponivel: true },
  { nome: 'Importação da sua planilha', desde: 'basico', disponivel: true },
  { nome: 'Comissão automática por item, com extrato do barbeiro', desde: 'pro', disponivel: true },
  { nome: 'Metas por unidade e serviço, com ritmo e projeção', desde: 'pro', disponivel: true },
  { nome: 'Clube da barbearia: assinatura, combos e convênios', desde: 'pro', disponivel: false },
  { nome: 'Bot de WhatsApp sem custo por mensagem', desde: 'pro', disponivel: false },
  { nome: 'Lista de espera', desde: 'pro', disponivel: false },
  { nome: 'Várias unidades e painel da rede', desde: 'premium', disponivel: true },
  { nome: 'Preço por unidade', desde: 'premium', disponivel: true },
  { nome: 'Lucro real e margem por serviço', desde: 'premium', disponivel: true },
  { nome: 'Campeonato dos barbeiros e TV da unidade', desde: 'premium', disponivel: false },
  { nome: 'Automações do bot e cobrança automática do clube', desde: 'premium', disponivel: false },
];

const ORDEM: Record<PlanoConta, number> = { basico: 0, pro: 1, premium: 2 };
export const incluiRecurso = (plano: PlanoConta, r: RecursoPlano) => ORDEM[plano] >= ORDEM[r.desde];

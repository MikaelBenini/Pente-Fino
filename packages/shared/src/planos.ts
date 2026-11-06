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

// ─── Recursos por plano (aplicados na API e na tela) ──────────────────────

/**
 * Recursos que a API confere pelo plano da conta. O que não está no plano aparece na tela com
 * convite para mudar; o que já foi lançado continua visível (só gravar de novo é bloqueado).
 */
export const RECURSOS = {
  comissoes: { nome: 'Comissão automática por item, com extrato do barbeiro', desde: 'pro' },
  metas: { nome: 'Metas por unidade e serviço, com ritmo e projeção', desde: 'pro' },
  clube: { nome: 'Clube da barbearia: assinatura, combos e convênios', desde: 'pro' },
  bot: { nome: 'Bot de WhatsApp sem custo por mensagem', desde: 'pro' },
  listaEspera: { nome: 'Lista de espera: o horário que vaga vai para quem pediu', desde: 'pro' },
  fichaProfissional: { nome: 'Ficha e ranking dos barbeiros', desde: 'pro' },
  avaliacoes: { nome: 'Pesquisa depois do atendimento, com as notas', desde: 'pro' },
  canais: { nome: 'Agendamentos por canal: balcão, WhatsApp e site', desde: 'pro' },
  rede: { nome: 'Várias unidades e painel da rede', desde: 'premium' },
  lucroReal: { nome: 'Lucro real e margem por serviço e produto', desde: 'premium' },
  automacoes: {
    nome: 'Automações do bot: retorno, aniversário e aviso do clube',
    desde: 'premium',
  },
} as const satisfies Record<string, { nome: string; desde: PlanoConta }>;
export type Recurso = keyof typeof RECURSOS;

const ORDEM: Record<PlanoConta, number> = { basico: 0, pro: 1, premium: 2 };

export const temRecurso = (plano: PlanoConta, r: Recurso) =>
  ORDEM[plano] >= ORDEM[RECURSOS[r].desde];

/** Frase do bloqueio (API) e do convite (tela). */
export function textoRecursoBloqueado(r: Recurso, plano: PlanoConta): string {
  const { nome, desde } = RECURSOS[r];
  return `${nome}: faz parte do plano ${NOME_PLANO[desde]}. Seu plano é o ${NOME_PLANO[plano]}; mude de plano para usar.`;
}

export interface RecursoPlano {
  nome: string;
  /** Plano a partir do qual o recurso vem. */
  desde: PlanoConta;
  /** false = ainda em construção; a página de vendas mostra "em breve". */
  disponivel: boolean;
  /** Recurso que a API confere (os demais vêm em todos os planos). */
  recurso?: Recurso;
}

const doRecurso = (recurso: Recurso): RecursoPlano => ({
  nome: RECURSOS[recurso].nome,
  desde: RECURSOS[recurso].desde,
  disponivel: true,
  recurso,
});

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
  doRecurso('comissoes'),
  doRecurso('metas'),
  doRecurso('clube'),
  doRecurso('bot'),
  doRecurso('listaEspera'),
  doRecurso('fichaProfissional'),
  doRecurso('avaliacoes'),
  doRecurso('canais'),
  doRecurso('rede'),
  { nome: 'Preço por unidade', desde: 'premium', disponivel: true },
  doRecurso('lucroReal'),
  doRecurso('automacoes'),
  { nome: 'Campeonato dos barbeiros e TV da unidade', desde: 'premium', disponivel: false },
  { nome: 'Cobrança automática do clube', desde: 'premium', disponivel: false },
];

export const incluiRecurso = (plano: PlanoConta, r: RecursoPlano) => ORDEM[plano] >= ORDEM[r.desde];

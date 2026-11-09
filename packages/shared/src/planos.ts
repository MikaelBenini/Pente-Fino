import { z } from 'zod';
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
export const VERSAO_TERMOS = '2026-11-09';

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

/**
 * Oferta de lançamento: 30% em toda mensalidade, enquanto a assinatura estiver ativa, para quem
 * assinar até a data. A urgência vem da data; o limite de vagas existe, mas o contador só
 * aparece quando sobra pouco (um contador cheio passa a ideia de que ninguém assinou).
 */
export const OFERTA_LANCAMENTO = {
  codigo: 'LANCAMENTO',
  descontoBp: 3000,
  ate: '2027-01-31',
  vagas: 20,
  mostrarVagasAte: 5,
} as const;

/** "Últimas 3 vagas" quando sobra pouco; null quando ainda há bastante (ou sem limite). */
export function textoVagasOferta(restantes: number | null): string | null {
  if (restantes === null || restantes <= 0 || restantes > OFERTA_LANCAMENTO.mostrarVagasAte)
    return null;
  return restantes === 1 ? 'Última vaga' : `Últimas ${restantes} vagas`;
}

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

// ─── Tabelas de preço com vigência (Etapa 15.1) ───────────────────────────

/** Uma tabela de preços que vale a partir de uma data (a administração cadastra novas). */
export interface TabelaPrecosPlanos {
  desde: string;
  planos: Record<PlanoConta, PrecoPlano>;
  unidadeExtra: PrecoPlano;
}

/** A tabela do lançamento: vale para quem assinou antes de qualquer outra. */
export const TABELA_PADRAO: TabelaPrecosPlanos = {
  desde: '2026-01-01',
  planos: { ...PRECOS_PLANO },
  unidadeExtra: { ...PRECO_UNIDADE_EXTRA },
};

const precoPlanoSchema = z.object({
  mensal: z.number().int().min(100, { error: 'Preço inválido.' }),
  anualPorMes: z.number().int().min(100, { error: 'Preço inválido.' }),
});
export const tabelaPrecosPlanosSchema = z.object({
  desde: z.iso.date({ error: 'Data inválida.' }),
  planos: z.object({ basico: precoPlanoSchema, pro: precoPlanoSchema, premium: precoPlanoSchema }),
  unidadeExtra: precoPlanoSchema,
});

/** Tabelas guardadas, em ordem de vigência, sempre com a do lançamento como base. */
export function lerTabelasPreco(json: unknown): TabelaPrecosPlanos[] {
  const lista = Array.isArray(json) ? json : [];
  const validas = lista
    .map((t) => tabelaPrecosPlanosSchema.safeParse(t))
    .filter((r) => r.success)
    .map((r) => r.data)
    .filter((t) => t.desde > TABELA_PADRAO.desde);
  const porData = new Map(validas.map((t) => [t.desde, t]));
  return [TABELA_PADRAO, ...[...porData.values()].sort((x, y) => x.desde.localeCompare(y.desde))];
}

/** A tabela que vale numa data (a mais recente que começou até ela). */
export function tabelaVigente(
  tabelas: readonly TabelaPrecosPlanos[],
  data: string | null,
): TabelaPrecosPlanos {
  const dia = data ?? TABELA_PADRAO.desde;
  return [...tabelas].reverse().find((t) => t.desde <= dia) ?? TABELA_PADRAO;
}

/** Quanto a rede paga por mês no ciclo escolhido (Premium cobra a partir da 2ª unidade). */
export function precoPorMes(
  plano: PlanoConta,
  ciclo: Ciclo,
  unidades = 1,
  tabela: TabelaPrecosPlanos = TABELA_PADRAO,
): number {
  const chave = ciclo === 'mensal' ? 'mensal' : 'anualPorMes';
  const extras = plano === 'premium' ? Math.max(0, unidades - 1) : 0;
  return tabela.planos[plano][chave] + extras * tabela.unidadeExtra[chave];
}

/** Total cobrado no anual e quanto se economiza contra 12 mensalidades. */
export function resumoAnual(
  plano: PlanoConta,
  unidades = 1,
  tabela: TabelaPrecosPlanos = TABELA_PADRAO,
): { total: number; economia: number } {
  const total = precoPorMes(plano, 'anual', unidades, tabela) * 12;
  return { total, economia: precoPorMes(plano, 'mensal', unidades, tabela) * 12 - total };
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
  {
    nome: 'Clube com cobrança automática pelo link (Pix e cartão)',
    desde: 'pro',
    disponivel: true,
  },
  doRecurso('bot'),
  doRecurso('listaEspera'),
  doRecurso('fichaProfissional'),
  doRecurso('avaliacoes'),
  doRecurso('canais'),
  doRecurso('rede'),
  { nome: 'Preço por unidade', desde: 'premium', disponivel: true },
  doRecurso('lucroReal'),
  doRecurso('automacoes'),
  { nome: 'Campeonato dos barbeiros', desde: 'premium', disponivel: false },
];

export const incluiRecurso = (plano: PlanoConta, r: RecursoPlano) => ORDEM[plano] >= ORDEM[r.desde];

// ─── Troca de plano pelo dono ─────────────────────────────────────────────

/** O que a conta usa hoje e que pesa na troca de plano. */
export interface UsoDaConta {
  unidades: number;
  profissionais: number;
  /** Alguma unidade com o WhatsApp conectado (o bot responde sozinho). */
  whatsappConectado: boolean;
  adesoesAtivas: number;
  esperaAguardando: number;
}

export interface PreviaTrocaPlano {
  de: PlanoConta;
  para: PlanoConta;
  sobe: boolean;
  /** Por mês, no ciclo da conta: o de hoje e o novo. */
  valorAtual: number;
  valorNovo: number;
  /** Impede a troca: resolver antes (limites do plano novo). */
  bloqueios: string[];
  /** Deixa de usar (o que já foi lançado continua guardado). */
  perdas: string[];
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Prévia da troca: subir vale na hora; descer só se a conta cabe no plano novo (unidades,
 * profissionais ativos e, no Básico, WhatsApp desconectado) e mostra o que deixa de usar.
 */
export function conferirTrocaDePlano(d: {
  de: PlanoConta;
  para: PlanoConta;
  ciclo: Ciclo;
  uso: UsoDaConta;
  /** Tabela que a conta contratou (valor de hoje) e a do dia (valor novo: troca é contrato novo). */
  tabelaAtual?: TabelaPrecosPlanos;
  tabelaNova?: TabelaPrecosPlanos;
  /** Desconto do cupom da conta (vale também no plano novo). */
  descontoBp?: number;
}): PreviaTrocaPlano {
  const { de, para, uso } = d;
  const limite = LIMITES_PLANO[para];
  const bloqueios: string[] = [];
  if (uso.unidades > limite.unidades)
    bloqueios.push(
      `O plano ${NOME_PLANO[para]} vai até ${plural(limite.unidades, 'unidade', 'unidades')}; a conta tem ${uso.unidades} ativas. Desative as que sobram em Configurações → Unidades.`,
    );
  if (uso.profissionais > limite.profissionais)
    bloqueios.push(
      `O plano ${NOME_PLANO[para]} vai até ${limite.profissionais} profissionais ativos; a conta tem ${uso.profissionais}. Registre a saída de quem não atende mais em Equipe.`,
    );
  if (!temRecurso(para, 'bot') && uso.whatsappConectado)
    bloqueios.push(
      `O bot do WhatsApp não faz parte do plano ${NOME_PLANO[para]}. Desconecte o WhatsApp em Bot → Conexão antes de mudar.`,
    );
  const perdas = (Object.keys(RECURSOS) as Recurso[])
    .filter((r) => temRecurso(de, r) && !temRecurso(para, r))
    .map((r) => {
      const nome = RECURSOS[r].nome;
      if (r === 'clube' && uso.adesoesAtivas > 0)
        return `${nome} (${plural(uso.adesoesAtivas, 'assinante continua', 'assinantes continuam')} cadastrados, sem novas adesões nem baixas)`;
      if (r === 'listaEspera' && uso.esperaAguardando > 0)
        return `${nome} (${plural(uso.esperaAguardando, 'pessoa espera', 'pessoas esperam')} hoje; deixam de receber ofertas)`;
      return nome;
    });
  return {
    de,
    para,
    sobe: ORDEM[para] > ORDEM[de],
    valorAtual: aplicarDesconto(
      precoPorMes(de, d.ciclo, uso.unidades, d.tabelaAtual),
      d.descontoBp,
    ),
    valorNovo: aplicarDesconto(
      precoPorMes(para, d.ciclo, uso.unidades, d.tabelaNova),
      d.descontoBp,
    ),
    bloqueios,
    perdas,
  };
}

export const trocarPlanoSchema = z.object({
  plano: z.enum(PLANOS, { error: 'Escolha o plano.' }),
});
export type TrocarPlanoEntrada = z.infer<typeof trocarPlanoSchema>;

// ─── Cupons (Etapa 15.1) ──────────────────────────────────────────────────

export const cupomSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9][A-Z0-9_-]{2,29}$/, { error: 'Código de 3 a 30 letras ou números.' }),
    ),
  descricao: z.string().trim().max(120).default(''),
  /** Desconto em pontos-base (3000 = 30%), enquanto a assinatura existir. */
  descontoBp: z.number().int().min(1, { error: 'Informe o desconto.' }).max(10000),
  /** Último dia em que o cupom aceita cadastro (null = sem prazo). */
  validoAte: z.iso.date().nullable().default(null),
  /** Quantas contas podem usar (null = sem limite). */
  vagas: z.number().int().min(1).nullable().default(null),
  ativo: z.boolean().default(true),
});
export type Cupom = z.infer<typeof cupomSchema>;

export function lerCupons(json: unknown): Cupom[] {
  const lista = Array.isArray(json) ? json : [];
  const porCodigo = new Map<string, Cupom>();
  for (const c of lista) {
    const r = cupomSchema.safeParse(c);
    if (r.success) porCodigo.set(r.data.codigo, r.data);
  }
  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export type ResultadoCupom =
  { ok: true; descontoBp: number; codigo: string } | { ok: false; motivo: string };

/** O cupom aceita uma conta nova hoje? (ativo, no prazo, com vaga) */
export function avaliarCupom(
  cupom: Cupom | null | undefined,
  d: { hoje: string; usados: number },
): ResultadoCupom {
  if (!cupom || !cupom.ativo) return { ok: false, motivo: 'Cupom não encontrado.' };
  if (cupom.validoAte && d.hoje > cupom.validoAte)
    return { ok: false, motivo: 'Este cupom já expirou.' };
  if (cupom.vagas !== null && d.usados >= cupom.vagas)
    return { ok: false, motivo: 'As vagas deste cupom acabaram.' };
  return { ok: true, descontoBp: cupom.descontoBp, codigo: cupom.codigo };
}

/** Valor com o desconto do cupom (arredondado para o centavo). */
export const aplicarDesconto = (valor: number, descontoBp = 0) =>
  Math.round((valor * (10000 - Math.min(10000, Math.max(0, descontoBp)))) / 10000);

/** Confere um código de cupom com o que o banco devolve (cupom cru e quantas contas usaram). */
export function conferirCupom(r: { cupom: unknown; usados: number }, hoje: string): ResultadoCupom {
  return avaliarCupom(lerCupons(r.cupom ? [r.cupom] : [])[0], { hoje, usados: r.usados });
}

export interface CupomNaTela extends Cupom {
  usados: number;
}

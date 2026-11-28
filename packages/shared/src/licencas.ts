// Licenças (ADR 0015, aprovada pelo dono em 27/11/2026): Pente Fino é a marca, e o que ela vende
// são licenças do sistema, uma por tipo de negócio. A licença define a tabela de preços e o que o
// sistema traz; o segmento (vocabulario.ts) define as palavras da tela. A Licença Beleza serve a
// salão e unhas, a Fitness a academia e personal, e a Atendimento (só o bot) a qualquer segmento.
// Só a administração troca a licença de uma conta.
import type { PlanoConta, PrecoPlano } from './planos.js';
import { SEGMENTOS, type Segmento } from './vocabulario.js';

export const LICENCAS = [
  'barbearia',
  'beleza',
  'estetica',
  'tatuagem',
  'fitness',
  'atendimento',
] as const;
export type Licenca = (typeof LICENCAS)[number];

export const NOME_LICENCA: Readonly<Record<Licenca, string>> = {
  barbearia: 'Barbearia',
  beleza: 'Beleza',
  estetica: 'Estética',
  tatuagem: 'Tatuagem',
  fitness: 'Fitness',
  atendimento: 'Atendimento',
};

/** Para quem é cada licença, na página de vendas e na administração. */
export const PARA_QUEM_LICENCA: Readonly<Record<Licenca, string>> = {
  barbearia: 'barbearias',
  beleza: 'salões de beleza, unhas e sobrancelhas',
  estetica: 'clínicas de estética',
  tatuagem: 'estúdios de tatuagem e piercing',
  fitness: 'academias, estúdios e personal trainers',
  atendimento: 'qualquer negócio que só quer o atendimento no WhatsApp',
};

/** Os segmentos (vocabulário) que cada licença aceita. */
export const SEGMENTOS_DA_LICENCA: Readonly<Record<Licenca, readonly Segmento[]>> = {
  // "Outro" usa a licença com a tabela de sempre (a vendida desde o lançamento).
  barbearia: ['barbearia', 'outro'],
  beleza: ['salao', 'unhas'],
  estetica: ['estetica'],
  tatuagem: ['tatuagem'],
  fitness: ['academia', 'personal'],
  atendimento: SEGMENTOS,
};

/** A licença de quem já tinha um segmento (migração de 27/11/2026). */
export function licencaDoSegmento(segmento: Segmento): Licenca {
  return (
    (LICENCAS.filter((l) => l !== 'atendimento') as Licenca[]).find((l) =>
      SEGMENTOS_DA_LICENCA[l].includes(segmento),
    ) ?? 'barbearia'
  );
}

/** O segmento combina com a licença? (a administração não grava combinação errada) */
export const segmentoNaLicenca = (licenca: Licenca, segmento: Segmento) =>
  SEGMENTOS_DA_LICENCA[licenca].includes(segmento);

/** O segmento de partida da licença (o primeiro da lista; Atendimento começa como barbearia). */
export const segmentoPadraoDaLicenca = (licenca: Licenca): Segmento =>
  SEGMENTOS_DA_LICENCA[licenca][0]!;

/**
 * À venda hoje. Fitness espera a Fase 1c (check-in, turmas e treino): sem isso não compete com
 * Tecnofit e MFIT (docs/concorrentes-e-precos.md).
 */
export const LICENCAS_A_VENDA: readonly Licenca[] = [
  'barbearia',
  'beleza',
  'estetica',
  'tatuagem',
  'atendimento',
];

/** Planos que cada licença vende. Atendimento tem um só (o Agenda com as Automações juntas). */
export const PLANOS_DA_LICENCA: Readonly<Record<Licenca, readonly PlanoConta[]>> = {
  barbearia: ['agenda', 'basico', 'pro', 'premium'],
  beleza: ['agenda', 'basico', 'pro', 'premium'],
  estetica: ['agenda', 'basico', 'pro', 'premium'],
  tatuagem: ['agenda', 'basico', 'pro', 'premium'],
  fitness: ['basico', 'pro', 'premium'],
  atendimento: ['agenda'],
};

/**
 * Preço de cada plano por licença (centavos), aprovado em 27/11/2026. Barbearia e Beleza usam a
 * tabela de planos de sempre (com vigência, cadastrada na administração); as demais, esta.
 */
export const PRECOS_LICENCA: Readonly<
  Record<Exclude<Licenca, 'barbearia' | 'beleza'>, Partial<Record<PlanoConta, PrecoPlano>>>
> = {
  estetica: {
    agenda: { mensal: 1490, anualPorMes: 1240 },
    basico: { mensal: 8990, anualPorMes: 7490 },
    pro: { mensal: 16990, anualPorMes: 14190 },
    premium: { mensal: 27990, anualPorMes: 23290 },
  },
  tatuagem: {
    agenda: { mensal: 1000, anualPorMes: 825 },
    basico: { mensal: 6990, anualPorMes: 5790 },
    pro: { mensal: 12990, anualPorMes: 10790 },
    premium: { mensal: 21990, anualPorMes: 18290 },
  },
  // Limite por aluno ativo entra na Fase 1c, junto com a venda.
  fitness: {
    basico: { mensal: 14990, anualPorMes: 12490 },
    pro: { mensal: 24990, anualPorMes: 20790 },
    premium: { mensal: 34990, anualPorMes: 29090 },
  },
  atendimento: { agenda: { mensal: 4990, anualPorMes: 4190 } },
};

/** Número de WhatsApp (unidade) além do primeiro na Licença Atendimento. */
export const PRECO_NUMERO_EXTRA_ATENDIMENTO: PrecoPlano = { mensal: 2990, anualPorMes: 2490 };

/** Profissionais na agenda por número de WhatsApp, na Licença Atendimento. */
export const PROFISSIONAIS_POR_NUMERO_ATENDIMENTO = 3;

/**
 * Telas que a licença não traz: saem do menu e não aparecem com cadeado (dentro da licença não há
 * plano que as libere). Atendimento é o bot com a agenda simples.
 */
export const TELAS_FORA_DA_LICENCA: Partial<Record<Licenca, readonly string[]>> = {
  atendimento: [
    'dia',
    'comandas',
    'caixa',
    'resultados',
    'financeiro',
    'comissoes',
    'desempenho',
    'produtos',
    'clube',
    'pagina',
  ],
};

/** O menu sem as telas que a licença não traz. */
export function menuDaLicenca<T extends { id: string }>(menu: readonly T[], licenca: Licenca): T[] {
  const fora = TELAS_FORA_DA_LICENCA[licenca] ?? [];
  return menu.filter((i) => !fora.includes(i.id));
}

/** Na Licença Atendimento as Automações (o bot inteiro) já vêm no preço. */
export const automacoesIncluidasNaLicenca = (licenca: Licenca) => licenca === 'atendimento';

/** Desconto na segunda conta (outro negócio, mesmo login), aprovado em 27/11/2026: 20%. */
export const DESCONTO_SEGUNDA_CONTA_BP = 2000;

/**
 * Licença e segmento de uma conta nova (cadastro pelo site ou venda presencial): o segmento
 * pedido, se combina com a licença; senão, o de partida dela. Devolve o erro quando a licença não
 * está à venda ou não tem o plano escolhido.
 */
export function licencaDaContaNova(d: {
  licenca: Licenca;
  segmento?: Segmento | null;
  plano: PlanoConta;
}): { licenca: Licenca; segmento: Segmento } | { erro: string } {
  if (!LICENCAS_A_VENDA.includes(d.licenca))
    return { erro: `A Licença ${NOME_LICENCA[d.licenca]} ainda não está à venda.` };
  if (!PLANOS_DA_LICENCA[d.licenca].includes(d.plano))
    return {
      erro: `A Licença ${NOME_LICENCA[d.licenca]} não tem esse plano. Escolha entre: ${PLANOS_DA_LICENCA[d.licenca].join(', ')}.`,
    };
  const segmento =
    d.segmento && segmentoNaLicenca(d.licenca, d.segmento)
      ? d.segmento
      : segmentoPadraoDaLicenca(d.licenca);
  return { licenca: d.licenca, segmento };
}

/**
 * O que a administração e a venda escolhem (pedido do dono em 28/11/2026: "licença e tipo de
 * negócio separados não faz sentido"): um campo só, "Produto". Cada produto é uma licença com o
 * tipo de negócio já dentro. Atendimento serve a qualquer negócio: o tipo fica o que a conta já
 * tem (ou é confirmado pelo dono no primeiro acesso).
 */
export const PRODUTOS = [
  'barbearia',
  'salao',
  'unhas',
  'estetica',
  'tatuagem',
  'atendimento',
] as const;
export type Produto = (typeof PRODUTOS)[number];

export const NOME_PRODUTO: Readonly<Record<Produto, string>> = {
  barbearia: 'Barbearia',
  salao: 'Salão de beleza',
  unhas: 'Unhas e sobrancelhas',
  estetica: 'Clínica de estética',
  tatuagem: 'Tatuagem e piercing',
  atendimento: 'Atendimento (só o bot de WhatsApp)',
};

const LICENCA_DO_PRODUTO: Readonly<Record<Produto, Licenca>> = {
  barbearia: 'barbearia',
  salao: 'beleza',
  unhas: 'beleza',
  estetica: 'estetica',
  tatuagem: 'tatuagem',
  atendimento: 'atendimento',
};

/**
 * Licença e tipo de negócio do produto. No Atendimento, o tipo é o que a conta já tem
 * (`segmentoAtual`); sem ele, barbearia (o dono confirma no primeiro acesso).
 */
export function licencaDoProduto(
  produto: Produto,
  segmentoAtual?: Segmento | null,
): { licenca: Licenca; segmento: Segmento } {
  const licenca = LICENCA_DO_PRODUTO[produto];
  if (licenca === 'atendimento') return { licenca, segmento: segmentoAtual ?? 'barbearia' };
  return { licenca, segmento: produto === 'barbearia' ? 'barbearia' : (produto as Segmento) };
}

/** O produto de uma conta (licença + tipo de negócio). */
export function produtoDaConta(licenca: Licenca, segmento: Segmento): Produto {
  if (licenca === 'atendimento') return 'atendimento';
  if (licenca === 'beleza') return segmento === 'unhas' ? 'unhas' : 'salao';
  if (licenca === 'fitness') return 'barbearia';
  return licenca;
}

// Vocabulário por segmento (Fase 1a do plano multissegmento, 27/11/2026). O sistema atende
// barbearia, salão, estética, unhas, tatuagem, academia e personal: o que a tela, o bot, os
// e-mails e os PDFs mostram vem daqui, nunca de "barbeiro" fixo no texto. Organizado por idioma
// (pt-BR agora; a estrutura aceita outros depois). A conta tem um segmento só (ADR 0014).

export const SEGMENTOS = [
  'barbearia',
  'salao',
  'estetica',
  'unhas',
  'tatuagem',
  'academia',
  'personal',
  'outro',
] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const IDIOMAS = ['pt-BR'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** Uma palavra com singular, plural e gênero (para "o barbeiro" / "a esteticista"). */
export interface Termo {
  um: string;
  muitos: string;
  feminino: boolean;
}

export interface Vocabulario {
  segmento: Segmento;
  /** Nome do segmento na escolha ("Barbearia", "Clínica de estética"...). */
  nomeSegmento: string;
  /** O negócio: barbearia, salão, clínica, estúdio, academia. */
  estabelecimento: Termo;
  /** Quem atende (o papel `profissional`). */
  profissional: Termo;
  /** Quem é atendido. */
  cliente: Termo;
  /** Cada vez que o cliente é atendido. */
  atendimento: Termo;
}

const t = (um: string, muitos: string, feminino = false): Termo => ({ um, muitos, feminino });

const PT_BR: Record<Segmento, Omit<Vocabulario, 'segmento'>> = {
  barbearia: {
    nomeSegmento: 'Barbearia',
    estabelecimento: t('barbearia', 'barbearias', true),
    profissional: t('barbeiro', 'barbeiros'),
    cliente: t('cliente', 'clientes'),
    atendimento: t('atendimento', 'atendimentos'),
  },
  salao: {
    nomeSegmento: 'Salão de beleza',
    estabelecimento: t('salão', 'salões'),
    profissional: t('profissional', 'profissionais'),
    cliente: t('cliente', 'clientes'),
    atendimento: t('atendimento', 'atendimentos'),
  },
  estetica: {
    nomeSegmento: 'Clínica de estética',
    estabelecimento: t('clínica', 'clínicas', true),
    profissional: t('esteticista', 'esteticistas', true),
    cliente: t('cliente', 'clientes'),
    atendimento: t('sessão', 'sessões', true),
  },
  unhas: {
    nomeSegmento: 'Unhas e sobrancelhas',
    estabelecimento: t('estúdio', 'estúdios'),
    profissional: t('profissional', 'profissionais'),
    cliente: t('cliente', 'clientes'),
    atendimento: t('atendimento', 'atendimentos'),
  },
  tatuagem: {
    nomeSegmento: 'Tatuagem e piercing',
    estabelecimento: t('estúdio', 'estúdios'),
    profissional: t('tatuador', 'tatuadores'),
    cliente: t('cliente', 'clientes'),
    atendimento: t('sessão', 'sessões', true),
  },
  academia: {
    nomeSegmento: 'Academia e estúdio (pilates, funcional)',
    estabelecimento: t('academia', 'academias', true),
    profissional: t('instrutor', 'instrutores'),
    cliente: t('aluno', 'alunos'),
    atendimento: t('aula', 'aulas', true),
  },
  personal: {
    nomeSegmento: 'Personal trainer',
    estabelecimento: t('estúdio', 'estúdios'),
    profissional: t('personal', 'personais'),
    cliente: t('aluno', 'alunos'),
    atendimento: t('aula', 'aulas', true),
  },
  outro: {
    nomeSegmento: 'Outro negócio com agenda',
    estabelecimento: t('negócio', 'negócios'),
    profissional: t('profissional', 'profissionais'),
    cliente: t('cliente', 'clientes'),
    atendimento: t('atendimento', 'atendimentos'),
  },
};

const POR_IDIOMA: Record<Idioma, typeof PT_BR> = { 'pt-BR': PT_BR };

/** O vocabulário do segmento. Segmento desconhecido (ou ausente) cai em barbearia. */
export function vocabulario(
  segmento: string | null | undefined,
  idioma: Idioma = 'pt-BR',
): Vocabulario {
  const s: Segmento = (SEGMENTOS as readonly string[]).includes(segmento ?? '')
    ? (segmento as Segmento)
    : 'barbearia';
  return { segmento: s, ...POR_IDIOMA[idioma][s] };
}

/** Primeira letra maiúscula: "barbeiro" → "Barbeiro". */
export const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Artigo definido: "o barbeiro", "a esteticista" (plural: "os", "as"). */
export function comArtigo(termo: Termo, plural = false): string {
  const artigo = termo.feminino ? (plural ? 'as' : 'a') : plural ? 'os' : 'o';
  return `${artigo} ${plural ? termo.muitos : termo.um}`;
}

// ─── Funções por conta ─────────────────────────────────────────────────────────

/**
 * Funções que cada conta liga ou desliga (S5). O padrão vem do segmento; o dono muda. Negócio
 * misto (barbearia que vende pacotes) liga a função sem trocar de segmento (ADR 0014). As
 * funções em si chegam nas fases seguintes; a API passa a conferir quando cada uma existir.
 */
export const FUNCOES = {
  pacotes: 'Pacotes de sessões com saldo',
  anamnese: 'Ficha e anamnese do cliente',
  fotos: 'Fotos de antes e depois',
  termo: 'Termo de consentimento',
  checkin: 'Check-in na entrada',
  turmas: 'Turmas com vagas',
} as const;
export type Funcao = keyof typeof FUNCOES;

export const FUNCOES_DO_SEGMENTO: Readonly<Record<Segmento, readonly Funcao[]>> = {
  barbearia: [],
  salao: [],
  estetica: ['pacotes', 'anamnese', 'fotos', 'termo'],
  unhas: ['pacotes'],
  tatuagem: ['fotos', 'termo'],
  academia: ['checkin', 'turmas'],
  personal: ['checkin'],
  outro: [],
};

/** As funções ligadas: a lista escolhida pelo dono ou, sem ela (null), o padrão do segmento. */
export function funcoesDaConta(
  segmento: string | null | undefined,
  escolhidas: readonly string[] | null,
): Funcao[] {
  const validas = (lista: readonly string[]) =>
    lista.filter((f): f is Funcao => Object.hasOwn(FUNCOES, f));
  if (escolhidas) return validas(escolhidas);
  return [...FUNCOES_DO_SEGMENTO[vocabulario(segmento).segmento]];
}

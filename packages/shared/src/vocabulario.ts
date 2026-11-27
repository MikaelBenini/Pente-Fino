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

// ─── Texto com o vocabulário ──────────────────────────────────────────────────

const CAMPOS = ['profissional', 'estabelecimento', 'cliente', 'atendimento'] as const;
type Campo = (typeof CAMPOS)[number];

/** Artigos e contrações antes do termo: [[o profissional]], [[da estabelecimento]]... */
const ARTIGOS: Record<string, [masc: string, fem: string, mascPl: string, femPl: string]> = {
  o: ['o', 'a', 'os', 'as'],
  a: ['o', 'a', 'os', 'as'],
  do: ['do', 'da', 'dos', 'das'],
  da: ['do', 'da', 'dos', 'das'],
  no: ['no', 'na', 'nos', 'nas'],
  na: ['no', 'na', 'nos', 'nas'],
  ao: ['ao', 'à', 'aos', 'às'],
  um: ['um', 'uma', 'uns', 'umas'],
  uma: ['um', 'uma', 'uns', 'umas'],
  pelo: ['pelo', 'pela', 'pelos', 'pelas'],
  pela: ['pelo', 'pela', 'pelos', 'pelas'],
  à: ['ao', 'à', 'aos', 'às'],
};
for (const [sing, plural] of [
  ['o', 'os'],
  ['a', 'as'],
  ['do', 'dos'],
  ['da', 'das'],
  ['no', 'nos'],
  ['na', 'nas'],
  ['ao', 'aos'],
  ['um', 'uns'],
  ['uma', 'umas'],
  ['pelo', 'pelos'],
  ['pela', 'pelas'],
  ['à', 'às'],
] as const)
  ARTIGOS[plural] = ARTIGOS[sing]!;

/**
 * Troca os marcadores pelo vocabulário: `[[profissional]]` → "barbeiro",
 * `[[Profissionais]]` → "Barbeiros", `[[o profissional]]` → "o barbeiro" ou "a esteticista",
 * `[[na estabelecimento]]` → "na barbearia" ou "no salão". Maiúscula no marcador vira maiúscula no
 * texto. Para barbearia, o resultado é o texto de sempre. Marcador desconhecido fica como está.
 */
export function comVocabulario(texto: string, v: Vocabulario): string {
  return texto.replace(
    /\[\[(?:(\p{L}+) )?(\p{L}+)\]\]/gu,
    (inteiro, artigoBruto: string | undefined, palavraBruta: string) => {
      const palavra = palavraBruta.toLowerCase();
      const plural = CAMPOS.every((c) => c !== palavra);
      const campo = (
        plural
          ? CAMPOS.find(
              (c) => `${c}s` === palavra || (c === 'profissional' && palavra === 'profissionais'),
            )
          : palavra
      ) as Campo | undefined;
      if (!campo) return inteiro;
      const termo = v[campo];
      let saida = plural ? termo.muitos : termo.um;
      if (artigoBruto) {
        const formas = ARTIGOS[artigoBruto.toLowerCase()];
        if (!formas) return inteiro;
        const artigo = formas[(termo.feminino ? 1 : 0) + (plural ? 2 : 0)]!;
        saida = `${artigo} ${saida}`;
        return artigoBruto[0] === artigoBruto[0]!.toUpperCase() ? maiuscula(saida) : saida;
      }
      return palavraBruta[0] === palavraBruta[0]!.toUpperCase() ? maiuscula(saida) : saida;
    },
  );
}

/**
 * comVocabulario em todos os textos de um objeto (menu do bot, mensagens prontas): devolve uma
 * cópia com os marcadores resolvidos. Chaves e o que não é texto ficam como estão.
 */
export function comVocabularioEmTudo<T>(valor: T, v: Vocabulario): T {
  if (typeof valor === 'string') return comVocabulario(valor, v) as T;
  if (Array.isArray(valor)) return valor.map((x) => comVocabularioEmTudo(x, v)) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, x]) => [k, comVocabularioEmTudo(x, v)]),
    ) as T;
  }
  return valor;
}

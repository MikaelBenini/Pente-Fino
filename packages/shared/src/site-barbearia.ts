// Site da barbearia (seção 7, lote 7a): o dono monta a página pública da unidade com blocos,
// como numa loja virtual. O conteúdo editável fica aqui (esquema, conteúdo inicial e regras);
// os dados vivos (serviços, preços, equipe, nota, horário) vêm do sistema na hora de mostrar.
import { z } from 'zod';

export const TEMAS_SITE = ['tradicional'] as const;
export type TemaSite = (typeof TEMAS_SITE)[number];

/**
 * Cores de destaque. Lista fechada para garantir leitura: o botão usa a cor de fundo com o texto
 * escuro do tema, e o teste confere o contraste de cada uma.
 */
export const CORES_SITE = {
  latao: { rotulo: 'Latão', hex: '#C8A55C' },
  cobre: { rotulo: 'Cobre', hex: '#D39B7A' },
  salvia: { rotulo: 'Sálvia', hex: '#9DB8A0' },
  gelo: { rotulo: 'Gelo', hex: '#E6E2D6' },
  rosa: { rotulo: 'Rosa antigo', hex: '#E3A6A6' },
} as const;
export type CorSite = keyof typeof CORES_SITE;
const IDS_CORES = Object.keys(CORES_SITE) as [CorSite, ...CorSite[]];

export const FONTES_SITE = {
  serifa: 'Clássica com serifa',
  condensada: 'Moderna condensada',
  letreiro: 'Letreiro',
} as const;
export type FonteSite = keyof typeof FONTES_SITE;
const IDS_FONTES = Object.keys(FONTES_SITE) as [FonteSite, ...FonteSite[]];

export const BOTOES_SITE = {
  retos: 'Cantos retos',
  arredondados: 'Arredondados',
  pilula: 'Pílula',
} as const;
export type BotoesSite = keyof typeof BOTOES_SITE;
const IDS_BOTOES = Object.keys(BOTOES_SITE) as [BotoesSite, ...BotoesSite[]];

export const PAGINAS_SITE = ['inicio', 'servicos', 'equipe', 'contato'] as const;
export type PaginaSite = (typeof PAGINAS_SITE)[number];
export const ROTULO_PAGINA: Record<PaginaSite, string> = {
  inicio: 'Início',
  servicos: 'Serviços',
  equipe: 'Equipe',
  contato: 'Contato',
};
/** Caminho de cada página dentro de /b/<slug>. */
export const CAMINHO_PAGINA: Record<PaginaSite, string> = {
  inicio: '',
  servicos: '/servicos',
  equipe: '/equipe',
  contato: '/contato',
};

interface DefinicaoBloco {
  rotulo: string;
  paginas: readonly PaginaSite[];
  /** Campos que o dono edita no painel. */
  titulo?: boolean;
  texto?: boolean;
  /** O bloco leva uma foto (lote 7c). */
  foto?: boolean;
  /**
   * Lista de itens (depoimentos, perguntas, galeria): o que cada campo do item quer dizer. Texto
   * vazio = o item não tem esse campo; `foto` = cada item leva uma foto.
   */
  itens?: { titulo: string; texto: string; foto?: boolean };
}

export const BLOCOS_SITE = {
  banner: { rotulo: 'Banner', paginas: ['inicio'], titulo: true, texto: true, foto: true },
  destaques: { rotulo: 'Faixa de destaques', paginas: ['inicio'] },
  sobre: { rotulo: 'Sobre a casa', paginas: ['inicio'], titulo: true, texto: true, foto: true },
  servicos: { rotulo: 'Serviços em destaque', paginas: ['inicio'], titulo: true },
  equipe: { rotulo: 'Equipe', paginas: ['inicio'], titulo: true },
  galeria: {
    rotulo: 'Galeria de fotos',
    paginas: ['inicio'],
    titulo: true,
    itens: { titulo: 'Legenda', texto: '', foto: true },
  },
  depoimentos: {
    rotulo: 'Depoimentos',
    paginas: ['inicio'],
    titulo: true,
    itens: { titulo: 'Quem disse', texto: 'O que disse' },
  },
  cabecalho: {
    rotulo: 'Título da página',
    paginas: ['servicos', 'equipe', 'contato'],
    titulo: true,
    texto: true,
  },
  tabela: { rotulo: 'Lista de serviços', paginas: ['servicos'] },
  barbeiros: { rotulo: 'Barbeiros', paginas: ['equipe'] },
  contato: { rotulo: 'Endereço, horário e contatos', paginas: ['contato'] },
  perguntas: {
    rotulo: 'Perguntas frequentes',
    paginas: ['contato'],
    titulo: true,
    itens: { titulo: 'Pergunta', texto: 'Resposta' },
  },
  agendar: {
    rotulo: 'Faixa de agendamento',
    paginas: ['inicio', 'servicos', 'equipe', 'contato'],
    titulo: true,
    texto: true,
  },
  /** Lote 7m: botões próprios com link (cardápio, loja, Instagram...). */
  botoes: {
    rotulo: 'Botões com link',
    paginas: ['inicio', 'servicos', 'equipe', 'contato'],
    titulo: true,
    itens: { titulo: 'Texto do botão', texto: 'Endereço (https://...)' },
  },
} as const satisfies Record<string, DefinicaoBloco>;
export type TipoBloco = keyof typeof BLOCOS_SITE;
const TIPOS = Object.keys(BLOCOS_SITE) as [TipoBloco, ...TipoBloco[]];

const textoCurto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Até ${max} caracteres.` });

/** Foto enviada pelo dono (tabela foto_site): o id vira o nome do arquivo. */
export const fotoIdSchema = z.uuid();

export const itemBlocoSchema = z.object({
  titulo: textoCurto(160),
  texto: textoCurto(600).default(''),
  foto: fotoIdSchema.optional(),
});

export const blocoSiteSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  tipo: z.enum(TIPOS),
  visivel: z.boolean(),
  titulo: textoCurto(120).optional(),
  texto: textoCurto(600).optional(),
  itens: z.array(itemBlocoSchema).max(12, { error: 'No máximo 12 itens.' }).optional(),
  foto: fotoIdSchema.optional(),
});
export type BlocoSite = z.infer<typeof blocoSiteSchema>;

const paginaSchema = (pagina: PaginaSite) =>
  z
    .array(blocoSiteSchema)
    .max(20)
    .superRefine((blocos, ctx) => {
      const ids = new Set<string>();
      for (const b of blocos) {
        if (!(BLOCOS_SITE[b.tipo].paginas as readonly string[]).includes(pagina))
          ctx.addIssue({
            code: 'custom',
            message: `O bloco "${BLOCOS_SITE[b.tipo].rotulo}" não vai na página ${ROTULO_PAGINA[pagina]}.`,
          });
        if (ids.has(b.id)) ctx.addIssue({ code: 'custom', message: 'Bloco repetido.' });
        if (b.tipo === 'botoes')
          for (const i of b.itens ?? [])
            if (i.texto && !urlDeLinkValida(i.texto))
              ctx.addIssue({
                code: 'custom',
                message: `O botão "${i.titulo || 'sem texto'}" tem um endereço inválido: comece com https://`,
              });
        ids.add(b.id);
      }
    });

/** Link que o dono põe no site: só endereço da web (https), nunca script. */
export function urlDeLinkValida(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname.includes('.');
  } catch {
    return false;
  }
}

export const linkSiteSchema = z.object({
  rotulo: z.string().trim().min(1, { error: 'Escreva o texto do link.' }).max(40),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(urlDeLinkValida, { error: 'Endereço inválido: comece com https://' }),
});
export type LinkSite = z.infer<typeof linkSiteSchema>;

/** Cabeçalho editável (lote 7n). Ausente = o padrão de sempre. */
export const cabecalhoSiteSchema = z.object({
  /** O que aparece no canto: o nome, o logotipo ou os dois. */
  mostrar: z.enum(['ambos', 'logo', 'nome']),
  /** Itens do menu na ordem do dono, com o texto e se aparecem. */
  menu: z
    .array(
      z.object({
        pagina: z.enum(PAGINAS_SITE),
        rotulo: z.string().trim().max(30),
        visivel: z.boolean(),
      }),
    )
    .max(PAGINAS_SITE.length),
  /** Texto do botão principal ("Agendar horário" quando vazio). */
  botao: z.string().trim().max(30),
  /** Links próprios no menu. */
  links: z.array(linkSiteSchema).max(3, { error: 'No máximo 3 links no menu.' }),
});
export type CabecalhoSite = z.infer<typeof cabecalhoSiteSchema>;

/** Rodapé editável (lote 7n). */
export const rodapeSiteSchema = z.object({
  endereco: z.boolean(),
  horario: z.boolean(),
  contato: z.boolean(),
  /** Texto livre (CNPJ, "aceitamos Pix"...). */
  texto: z.string().trim().max(400),
  links: z.array(linkSiteSchema).max(6, { error: 'No máximo 6 links no rodapé.' }),
  /** Redes além do Instagram (endereço completo). */
  facebook: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || urlDeLinkValida(v), { error: 'Endereço do Facebook inválido.' }),
  tiktok: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || urlDeLinkValida(v), { error: 'Endereço do TikTok inválido.' }),
  youtube: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || urlDeLinkValida(v), { error: 'Endereço do YouTube inválido.' }),
  /** A linha "Site e agenda pelo Pente Fino" (o dono pode desligar). */
  creditos: z.boolean(),
});
export type RodapeSite = z.infer<typeof rodapeSiteSchema>;

export const LIMITE_CSS_SITE = 8000;

export const siteBarbeariaSchema = z.object({
  versao: z.literal(1),
  /** Logotipo no cabeçalho (lote 7c); sem ele, o monograma com a inicial. */
  logo: fotoIdSchema.optional(),
  tema: z.enum(TEMAS_SITE),
  cor: z.enum(IDS_CORES),
  fonte: z.enum(IDS_FONTES),
  botoes: z.enum(IDS_BOTOES),
  /** Frase curta do rodapé, embaixo do nome. */
  slogan: textoCurto(160),
  /** Usuário do Instagram, sem o @. Vazio = não mostra. */
  instagram: z
    .string()
    .trim()
    .transform((t) => t.replace(/^@/, ''))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, { error: 'Usuário do Instagram inválido.' })),
  paginas: z.object({
    inicio: paginaSchema('inicio'),
    servicos: paginaSchema('servicos'),
    equipe: paginaSchema('equipe'),
    contato: paginaSchema('contato'),
  }),
  cabecalho: cabecalhoSiteSchema.optional(),
  rodape: rodapeSiteSchema.optional(),
  /** CSS do dono para ir além do tema (limpo por limparCssSite antes de entrar na página). */
  css: z
    .string()
    .max(LIMITE_CSS_SITE, { error: `CSS grande demais (até ${LIMITE_CSS_SITE} letras).` })
    .optional(),
  /** O que aparece de cada barbeiro (por id do profissional): especialidade e apresentação. */
  equipe: z
    .record(
      z.uuid(),
      z.object({ foco: textoCurto(80), sobre: textoCurto(600), foto: fotoIdSchema.optional() }),
    )
    .refine((r) => Object.keys(r).length <= 100, { error: 'Equipe grande demais.' }),
});
export type SiteBarbearia = z.infer<typeof siteBarbeariaSchema>;

/**
 * Página já montada, com textos sugeridos (decisão do dono, 13/11): o dono só ajusta. Nada de
 * número inventado: nota, preço e horário vêm do sistema; depoimentos começam escondidos e vazios.
 */
export function siteInicial(barbearia: string): SiteBarbearia {
  const nome = barbearia.trim() || 'a barbearia';
  return {
    versao: 1,
    tema: 'tradicional',
    cor: 'latao',
    fonte: 'serifa',
    botoes: 'retos',
    slogan: 'Corte e barba com hora marcada.',
    instagram: '',
    paginas: {
      inicio: [
        {
          id: 'banner',
          tipo: 'banner',
          visivel: true,
          titulo: 'Corte, barba e atendimento sem pressa.',
          texto:
            'Escolha o serviço, o barbeiro e o horário pelo site. Chegou, sentou: a cadeira já está esperando.',
        },
        { id: 'destaques', tipo: 'destaques', visivel: true },
        {
          id: 'sobre',
          tipo: 'sobre',
          visivel: true,
          titulo: `Conheça a ${nome}`,
          texto:
            'Aqui cada cliente tem hora marcada e é atendido por quem conhece o seu corte. Venha tomar um café e sair do jeito que você pediu.',
        },
        { id: 'servicos', tipo: 'servicos', visivel: true, titulo: 'Os mais pedidos' },
        { id: 'equipe', tipo: 'equipe', visivel: true, titulo: 'Os barbeiros' },
        { id: 'galeria', tipo: 'galeria', visivel: false, titulo: 'Nosso trabalho', itens: [] },
        {
          id: 'depoimentos',
          tipo: 'depoimentos',
          visivel: false,
          titulo: 'Quem corta aqui, volta',
          itens: [],
        },
        {
          id: 'agendar',
          tipo: 'agendar',
          visivel: true,
          titulo: 'Marque seu horário',
          texto: 'Escolha o serviço, o barbeiro e o horário. Leva menos de um minuto.',
        },
      ],
      servicos: [
        {
          id: 'cabecalho',
          tipo: 'cabecalho',
          visivel: true,
          titulo: 'Serviços e preços',
          texto: 'Escolha o serviço e marque o horário com o barbeiro que preferir.',
        },
        { id: 'tabela', tipo: 'tabela', visivel: true },
        {
          id: 'agendar',
          tipo: 'agendar',
          visivel: true,
          titulo: 'Escolheu? Marque em menos de um minuto.',
          texto: '',
        },
      ],
      equipe: [
        {
          id: 'cabecalho',
          tipo: 'cabecalho',
          visivel: true,
          titulo: 'A equipe',
          texto: 'Escolha com quem você quer cortar, ou deixe que o primeiro livre te atenda.',
        },
        { id: 'barbeiros', tipo: 'barbeiros', visivel: true },
        {
          id: 'agendar',
          tipo: 'agendar',
          visivel: true,
          titulo: 'Tanto faz o barbeiro? Pegue o primeiro horário livre.',
          texto: '',
        },
      ],
      contato: [
        {
          id: 'cabecalho',
          tipo: 'cabecalho',
          visivel: true,
          titulo: 'Contato e endereço',
          texto: '',
        },
        { id: 'contato', tipo: 'contato', visivel: true },
        {
          id: 'perguntas',
          tipo: 'perguntas',
          visivel: true,
          titulo: 'Perguntas frequentes',
          itens: [
            {
              titulo: 'Precisa marcar horário?',
              texto:
                'Recomendamos marcar pelo site para não esperar. Se tiver cadeira livre, atendemos na hora.',
            },
            {
              titulo: 'E se eu precisar desmarcar?',
              texto: 'Pelo link da confirmação você remarca ou cancela sem precisar ligar.',
            },
          ],
        },
        {
          id: 'agendar',
          tipo: 'agendar',
          visivel: true,
          titulo: 'A cadeira está te esperando.',
          texto: '',
        },
      ],
    },
    equipe: {},
  };
}

/** Lê o que está gravado; sem nada ou inválido, devolve a página inicial sugerida. */
export function lerSite(valor: unknown, barbearia: string): SiteBarbearia {
  const r = siteBarbeariaSchema.safeParse(valor);
  return r.success ? r.data : siteInicial(barbearia);
}

/** Blocos que aparecem na página, na ordem do dono. */
export function blocosVisiveis(site: SiteBarbearia, pagina: PaginaSite): BlocoSite[] {
  return site.paginas[pagina].filter((b) => b.visivel);
}

// ─── Horário da unidade ─────────────────────────────────────────────────────

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** A semana do jeito que o cliente lê: de segunda a domingo. */
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** 540 → "9h"; 570 → "9h30". */
export function formatarMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export interface LinhaHorario {
  dias: string;
  /** null = fechado. */
  horario: string | null;
}

/**
 * Horário de funcionamento a partir do expediente da equipe: em cada dia de trabalho da unidade,
 * do primeiro barbeiro que chega ao último que sai. Dias seguidos com o mesmo horário viram uma
 * linha só ("Terça a sexta, 9h às 20h").
 */
export function horarioDaUnidade(
  expedientes: readonly { diaSemana: number; inicioMin: number; fimMin: number }[],
  diasTrabalho: readonly number[],
): LinhaHorario[] {
  const porDia = ORDEM_SEMANA.map((dia) => {
    if (!diasTrabalho.includes(dia)) return { dia, horario: null };
    const doDia = expedientes.filter((e) => e.diaSemana === dia && e.fimMin > e.inicioMin);
    if (!doDia.length) return { dia, horario: null };
    const inicio = Math.min(...doDia.map((e) => e.inicioMin));
    const fim = Math.max(...doDia.map((e) => e.fimMin));
    return { dia, horario: `${formatarMinutos(inicio)} às ${formatarMinutos(fim)}` };
  });
  const grupos: { dias: number[]; horario: string | null }[] = [];
  for (const d of porDia) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.horario === d.horario) ultimo.dias.push(d.dia);
    else grupos.push({ dias: [d.dia], horario: d.horario });
  }
  // Fechados vão para o fim, juntos ("Domingo e segunda, fechado").
  const abertos = grupos.filter((g) => g.horario !== null);
  const fechados = grupos.filter((g) => g.horario === null).flatMap((g) => g.dias);
  const nomeGrupo = (dias: number[], seguidos: boolean) => {
    const nomes = dias.map((d) => DIAS[d]!);
    const texto =
      nomes.length === 1
        ? nomes[0]!
        : seguidos && nomes.length > 2
          ? `${nomes[0]} a ${nomes[nomes.length - 1]}`
          : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  };
  const linhas: LinhaHorario[] = abertos.map((g) => ({
    dias: nomeGrupo(g.dias, true),
    horario: g.horario,
  }));
  if (fechados.length) linhas.push({ dias: nomeGrupo(fechados, false), horario: null });
  return linhas;
}

// ─── Nota e links ───────────────────────────────────────────────────────────

/** Abaixo disso a média engana: a faixa de destaques não mostra a nota. */
export const MINIMO_AVALIACOES_SITE = 5;

/** Média das notas da barbearia (uma casa decimal), só com avaliações suficientes. */
export function notaDoSite(notas: readonly number[]): { media: number; total: number } | null {
  const validas = notas.filter((n) => n >= 1 && n <= 5);
  if (validas.length < MINIMO_AVALIACOES_SITE) return null;
  const media = validas.reduce((s, n) => s + n, 0) / validas.length;
  return { media: Math.round(media * 10) / 10, total: validas.length };
}

export function linkDoMapa(endereco: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}

/** wa.me do telefone da unidade (só dígitos, com 55); null quando não dá para montar. */
export function linkWhatsappDaUnidade(telefone: string | null): string | null {
  if (!telefone) return null;
  const d = telefone.replace(/\D/g, '');
  const completo = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return /^\d{12,13}$/.test(completo) ? `https://wa.me/${completo}` : null;
}

// ─── O que a página pública recebe ──────────────────────────────────────────

export interface SitePublico {
  /** Endereço do site: /s/<slug> (lote 7d). */
  slug: string;
  /** Link de agendamento atual (/b/<slugAgendamento>), para onde vão os botões "Agendar". */
  slugAgendamento: string;
  barbearia: string;
  unidade: string;
  site: SiteBarbearia;
  endereco: string | null;
  telefone: string | null;
  whatsapp: string | null;
  aparecerNoGoogle: boolean;
  servicos: {
    id: string;
    nome: string;
    categoria: string | null;
    duracaoMin: number;
    preco: number;
    ehExtra: boolean;
  }[];
  equipe: { id: string; nome: string; foco: string; sobre: string }[];
  horario: LinhaHorario[];
  nota: { media: number; total: number } | null;
  /** Medidas das fotos usadas (evita a página pular enquanto carrega). */
  fotos: Record<string, { largura: number; altura: number }>;
}

/** Serviços em destaque no Início: os três primeiros principais (extras não entram). */
export function servicosEmDestaque(servicos: SitePublico['servicos'], quantos = 3) {
  return servicos.filter((s) => !s.ehExtra).slice(0, quantos);
}

/** Lista de serviços agrupada por categoria (sem categoria = "Serviços"; extras no fim). */
export function servicosPorCategoria(servicos: SitePublico['servicos']) {
  const grupos = new Map<string, SitePublico['servicos']>();
  for (const s of servicos.filter((x) => !x.ehExtra)) {
    const nome = s.categoria?.trim() || 'Serviços';
    grupos.set(nome, [...(grupos.get(nome) ?? []), s]);
  }
  const extras = servicos.filter((x) => x.ehExtra);
  if (extras.length) grupos.set('Adicionais', extras);
  return [...grupos].map(([nome, itens]) => ({ nome, itens }));
}

/** O que o painel recebe para editar o site da unidade. */
export interface SitePainel {
  rascunho: SiteBarbearia;
  /** Há um site publicado em /s/<siteSlug>. */
  publicado: boolean;
  publicadoEm: string | null;
  /** O rascunho mudou desde a última publicação. */
  alteracoesPendentes: boolean;
  /** Link de agendamento (/b/<slug>); sem ele, ou desligado, não dá para publicar. */
  slug: string | null;
  linkLigado: boolean;
  /** Endereço do site (/s/<siteSlug>), separado do link; null até escolher ou publicar. */
  siteSlug: string | null;
  /** Sugestão para o endereço do site enquanto ele não existe. */
  sugestaoSiteSlug: string;
  /** Domínio próprio da barbearia (lote 7e), sem "www."; null = não tem. */
  dominio: string | null;
  /** O DNS do domínio já aponta para o Pente Fino: o site abre nele. */
  dominioVerificado: boolean;
  /** Para onde o registro A do domínio deve apontar (IP do servidor), quando se sabe. */
  dominioIps: string[];
}

/** Caminho público do site e do agendamento (lote 7d): coisas diferentes, endereços diferentes. */
export const caminhoDoSite = (siteSlug: string) => `/s/${siteSlug}`;
export const caminhoDoAgendamento = (slug: string) => `/b/${slug}`;

/** Troca do endereço do site no painel. */
export const enderecoSiteSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      error: 'Use letras minúsculas, números e hífen, sem espaço.',
    })
    .min(3, { error: 'No mínimo 3 letras.' })
    .max(60, { error: 'No máximo 60 letras.' }),
});
export type EnderecoSite = z.infer<typeof enderecoSiteSchema>;

export type TipoEndereco = 'agendamento' | 'site';

// ─── Operações do painel (lote 7b) ──────────────────────────────────────────

const comPagina = (
  site: SiteBarbearia,
  pagina: PaginaSite,
  blocos: BlocoSite[],
): SiteBarbearia => ({
  ...site,
  paginas: { ...site.paginas, [pagina]: blocos },
});

/** Sobe (-1) ou desce (+1) o bloco na página; nas pontas, fica onde está. */
export function moverBloco(
  site: SiteBarbearia,
  pagina: PaginaSite,
  id: string,
  delta: -1 | 1,
): SiteBarbearia {
  const blocos = [...site.paginas[pagina]];
  const i = blocos.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= blocos.length) return site;
  [blocos[i], blocos[j]] = [blocos[j]!, blocos[i]!];
  return comPagina(site, pagina, blocos);
}

/** Muda campos de um bloco (visível, título, texto, itens). */
export function editarBloco(
  site: SiteBarbearia,
  pagina: PaginaSite,
  id: string,
  mudanca: Partial<Omit<BlocoSite, 'id' | 'tipo'>>,
): SiteBarbearia {
  return comPagina(
    site,
    pagina,
    site.paginas[pagina].map((b) => (b.id === id ? { ...b, ...mudanca } : b)),
  );
}

export function removerBloco(site: SiteBarbearia, pagina: PaginaSite, id: string): SiteBarbearia {
  return comPagina(
    site,
    pagina,
    site.paginas[pagina].filter((b) => b.id !== id),
  );
}

/** Tipos que ainda dá para pôr na página (cada bloco aparece uma vez por página). */
export function blocosParaAdicionar(site: SiteBarbearia, pagina: PaginaSite): TipoBloco[] {
  const presentes = new Set(site.paginas[pagina].map((b) => b.tipo));
  return TIPOS.filter(
    (t) => (BLOCOS_SITE[t].paginas as readonly string[]).includes(pagina) && !presentes.has(t),
  );
}

/**
 * Põe o bloco de volta no fim da página (antes da faixa de agendamento, que fecha a página),
 * com os textos sugeridos da página inicial quando houver.
 */
export function adicionarBloco(
  site: SiteBarbearia,
  pagina: PaginaSite,
  tipo: TipoBloco,
  barbearia: string,
): SiteBarbearia {
  if (!blocosParaAdicionar(site, pagina).includes(tipo)) return site;
  const modelo = siteInicial(barbearia).paginas[pagina].find((b) => b.tipo === tipo);
  const usados = new Set(site.paginas[pagina].map((b) => b.id));
  let id: string = tipo;
  for (let n = 2; usados.has(id); n++) id = `${tipo}-${n}`;
  const novo: BlocoSite = { ...(modelo ?? { tipo, visivel: true }), id, visivel: true };
  const blocos = [...site.paginas[pagina]];
  const fim = blocos.findIndex((b) => b.tipo === 'agendar');
  blocos.splice(fim < 0 || tipo === 'agendar' ? blocos.length : fim, 0, novo);
  return comPagina(site, pagina, blocos);
}

// ─── Fotos (lote 7c) ────────────────────────────────────────────────────────

/** Tamanhos guardados de cada foto (largura máxima, em px). */
export const TAMANHOS_FOTO = [640, 1600] as const;
export type TamanhoFoto = (typeof TAMANHOS_FOTO)[number];

/** Endereço público da foto: /f/<id>-<tamanho>.webp. */
export function urlDaFoto(id: string, tamanho: TamanhoFoto = 1600): string {
  return `/f/${id}-${tamanho}.webp`;
}

/** Nome de arquivo aceito em /f/ (o id e um dos tamanhos). */
export const NOME_ARQUIVO_FOTO =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(640|1600)\.webp$/;

/** Todas as fotos que o site usa (logo, blocos, itens e barbeiros), sem repetir. */
export function fotosDoSite(site: SiteBarbearia): string[] {
  const ids = new Set<string>();
  if (site.logo) ids.add(site.logo);
  for (const p of PAGINAS_SITE)
    for (const b of site.paginas[p]) {
      if (b.foto) ids.add(b.foto);
      for (const i of b.itens ?? []) if (i.foto) ids.add(i.foto);
    }
  for (const e of Object.values(site.equipe)) if (e.foto) ids.add(e.foto);
  return [...ids];
}

/** Maior arquivo aceito, já reduzido no navegador (a ponte do painel aceita até 1 MB). */
export const MAXIMO_BYTES_FOTO = 700 * 1024;

/** Envio de foto: a imagem reduzida no navegador, em base64. */
export const envioFotoSchema = z.object({
  tipo: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  dados: z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, { error: 'Arquivo inválido.' })
    .max(Math.ceil((MAXIMO_BYTES_FOTO * 4) / 3) + 4, {
      error: 'Foto grande demais. Tente outra.',
    }),
});
export type EnvioFoto = z.infer<typeof envioFotoSchema>;

export interface FotoEnviada {
  id: string;
  largura: number;
  altura: number;
}

// ─── Domínio próprio (lote 7e) ──────────────────────────────────────────────

const HOSTNAME = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * "https://www.BarbeariaDoCarlos.com.br/" → "barbeariadocarlos.com.br". Guarda sem o "www.": o
 * site abre nos dois. null quando não é um domínio.
 */
export function normalizarDominio(texto: string): string | null {
  const d = texto
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  return HOSTNAME.test(d) ? d : null;
}

export const dominioSchema = z.object({
  dominio: z
    .string()
    .max(260)
    .transform((t, ctx) => {
      const d = normalizarDominio(t);
      if (!d) {
        ctx.addIssue({
          code: 'custom',
          message: 'Domínio inválido. Escreva como barbeariadocarlos.com.br.',
        });
        return z.NEVER;
      }
      return d;
    }),
});
export type DominioEntrada = z.infer<typeof dominioSchema>;

/** O que a página no domínio próprio precisa: os dois endereços da unidade. */
export interface DominioPublico {
  siteSlug: string;
  slugAgendamento: string;
}

// ─── Cabeçalho, rodapé, botões e CSS (lotes 7m e 7n) ────────────────────────

/** Cabeçalho com os valores de sempre onde o dono não mexeu. */
export function cabecalhoDoSite(site: SiteBarbearia): CabecalhoSite {
  const c = site.cabecalho;
  const menu = PAGINAS_SITE.map(
    (p) => c?.menu.find((m) => m.pagina === p) ?? { pagina: p, rotulo: '', visivel: true },
  );
  // A ordem do dono primeiro; página que faltar vai para o fim.
  const ordem = c?.menu.map((m) => m.pagina) ?? [];
  menu.sort((a, b) => {
    const ia = ordem.indexOf(a.pagina);
    const ib = ordem.indexOf(b.pagina);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return { mostrar: c?.mostrar ?? 'ambos', menu, botao: c?.botao ?? '', links: c?.links ?? [] };
}

export function rodapeDoSite(site: SiteBarbearia): RodapeSite {
  return (
    site.rodape ?? {
      endereco: true,
      horario: true,
      contato: true,
      texto: '',
      links: [],
      facebook: '',
      tiktok: '',
      youtube: '',
      creditos: true,
    }
  );
}

/**
 * CSS do dono, limpo para entrar só no site dele: sem buscar nada de fora (@import, url()), sem
 * truques antigos que rodam código (expression, behavior, -moz-binding, javascript:) e sem fechar
 * a tag de estilo. O resultado vai dentro de `.site-personalizado { ... }` (aninhamento de CSS),
 * então não alcança nada fora do site.
 */
export function limparCssSite(css: string | undefined): string {
  if (!css) return '';
  return (
    css
      .slice(0, LIMITE_CSS_SITE)
      // Primeiro o que serve para disfarçar (barra invertida e comentários: u\\rl, u/**/rl).
      .replace(/\\/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<\/?\s*style/gi, '')
      .replace(/<!--|-->/g, '')
      .replace(/@import[^;]*;?/gi, '')
      .replace(/@charset[^;]*;?/gi, '')
      .replace(/@namespace[^;]*;?/gi, '')
      .replace(/url\s*\([^)]*\)/gi, 'none')
      .replace(/image-set\s*\([^)]*\)/gi, 'none')
      .replace(/expression\s*\(/gi, '(')
      .replace(/javascript\s*:/gi, '')
      .replace(/behavior\s*:/gi, 'x-behavior:')
      .replace(/-moz-binding/gi, 'x-moz-binding')
      .trim()
  );
}

// ─── Visual da página de agendamento (lote 7l) ──────────────────────────────

/**
 * A página de agendamento (/b/<link>) com a cara da barbearia: cor, logotipo, foto de capa e um
 * texto de boas-vindas. Fica separado do site (decisão do dono: o site é uma coisa, o link é
 * outra) e vale assim que salva. Desligado = o visual de sempre do Pente Fino.
 */
export const visualAgendamentoSchema = z.object({
  ativo: z.boolean(),
  cor: z.enum(IDS_CORES),
  logo: fotoIdSchema.optional(),
  capa: fotoIdSchema.optional(),
  titulo: textoCurto(80),
  texto: textoCurto(300),
  /** Mostra "Ver o site da barbearia" (só quando o site está publicado). */
  linkSite: z.boolean(),
});
export type VisualAgendamento = z.infer<typeof visualAgendamentoSchema>;

/** Ponto de partida: o que o site já tem (cor e logotipo), desligado. */
export function visualAgendamentoInicial(site?: SiteBarbearia | null): VisualAgendamento {
  return {
    ativo: false,
    cor: site?.cor ?? 'latao',
    ...(site?.logo ? { logo: site.logo } : {}),
    titulo: '',
    texto: '',
    linkSite: true,
  };
}

export function lerVisualAgendamento(valor: unknown): VisualAgendamento | null {
  const r = visualAgendamentoSchema.safeParse(valor);
  return r.success ? r.data : null;
}

export const fotosDoVisual = (v: VisualAgendamento) =>
  [v.logo, v.capa].filter((x): x is string => !!x);

/** O que a página de agendamento recebe (só quando o visual está ligado). */
export interface VisualAgendamentoPublico {
  /** Cor de destaque (hex), lida bem com o texto escuro dos botões. */
  cor: string;
  logo: string | null;
  capa: string | null;
  titulo: string;
  texto: string;
  /** Endereço do site publicado (/s/...), quando o dono quer o link para ele. */
  site: string | null;
}

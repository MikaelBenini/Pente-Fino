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
        ids.add(b.id);
      }
    });

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
  slug: string;
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
  /** Há um site publicado: /b/<slug> mostra o site, e não a página de agendamento. */
  publicado: boolean;
  publicadoEm: string | null;
  /** O rascunho mudou desde a última publicação. */
  alteracoesPendentes: boolean;
  /** Endereço da página; sem ele (ou com o link desligado) não dá para publicar. */
  slug: string | null;
  linkLigado: boolean;
}

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

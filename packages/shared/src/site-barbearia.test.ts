import { describe, expect, it } from 'vitest';
import {
  BLOCOS_SITE,
  NOME_ARQUIVO_FOTO,
  envioFotoSchema,
  fotosDoSite,
  urlDaFoto,
  adicionarBloco,
  blocosParaAdicionar,
  editarBloco,
  moverBloco,
  removerBloco,
  CORES_SITE,
  PAGINAS_SITE,
  blocosVisiveis,
  formatarMinutos,
  horarioDaUnidade,
  lerSite,
  linkDoMapa,
  linkWhatsappDaUnidade,
  notaDoSite,
  servicosEmDestaque,
  servicosPorCategoria,
  siteBarbeariaSchema,
  siteInicial,
} from './site-barbearia.js';

/** Contraste WCAG entre duas cores #RRGGBB. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe('site da barbearia (lote 7a)', () => {
  it('a página inicial sugerida é válida e traz as quatro páginas montadas', () => {
    const site = siteInicial('Barbearia do Carlos');
    expect(siteBarbeariaSchema.parse(site)).toEqual(site);
    for (const p of PAGINAS_SITE) expect(site.paginas[p].length).toBeGreaterThan(1);
    expect(site.paginas.inicio.find((b) => b.tipo === 'sobre')?.titulo).toBe(
      'Conheça a Barbearia do Carlos',
    );
    // Depoimento não se inventa: começa escondido e vazio.
    expect(site.paginas.inicio.find((b) => b.tipo === 'depoimentos')).toMatchObject({
      visivel: false,
      itens: [],
    });
  });

  it('cada cor de destaque tem leitura com o texto escuro do botão e o fundo do tema', () => {
    for (const { hex } of Object.values(CORES_SITE)) {
      expect(contraste(hex, '#14271C')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('recusa bloco fora da página certa e bloco repetido', () => {
    const site = siteInicial('X');
    const errado = {
      ...site,
      paginas: { ...site.paginas, contato: [{ id: 'tabela', tipo: 'tabela', visivel: true }] },
    };
    expect(siteBarbeariaSchema.safeParse(errado).success).toBe(false);
    const repetido = {
      ...site,
      paginas: {
        ...site.paginas,
        servicos: [site.paginas.servicos[0], site.paginas.servicos[0]],
      },
    };
    expect(siteBarbeariaSchema.safeParse(repetido).success).toBe(false);
    for (const [tipo, def] of Object.entries(BLOCOS_SITE))
      expect(def.paginas.length, tipo).toBeGreaterThan(0);
  });

  it('Instagram aceita com ou sem @ e guarda sem', () => {
    const r = siteBarbeariaSchema.parse({ ...siteInicial('X'), instagram: '@barbearia.do_carlos' });
    expect(r.instagram).toBe('barbearia.do_carlos');
    expect(
      siteBarbeariaSchema.safeParse({ ...siteInicial('X'), instagram: 'tem espaço' }).success,
    ).toBe(false);
  });

  it('lerSite usa a página sugerida quando não há nada gravado ou o gravado é inválido', () => {
    expect(lerSite(null, 'Navalha').paginas.inicio[2]?.titulo).toBe('Conheça a Navalha');
    expect(lerSite({ versao: 9 }, 'Navalha').tema).toBe('tradicional');
    const site = { ...siteInicial('Navalha'), cor: 'salvia' as const };
    expect(lerSite(site, 'Outra').cor).toBe('salvia');
  });

  it('blocosVisiveis respeita a ordem e esconde os desligados', () => {
    const site = siteInicial('X');
    expect(blocosVisiveis(site, 'inicio').map((b) => b.tipo)).toEqual([
      'banner',
      'destaques',
      'sobre',
      'servicos',
      'equipe',
      'agendar',
    ]);
  });

  it('horário: junta dias seguidos iguais e põe os fechados no fim', () => {
    const exp = [
      ...[2, 3, 4, 5].map((d) => ({ diaSemana: d, inicioMin: 540, fimMin: 1200 })),
      { diaSemana: 2, inicioMin: 600, fimMin: 1140 }, // outro barbeiro, dentro do horário
      { diaSemana: 6, inicioMin: 480, fimMin: 1080 },
      { diaSemana: 1, inicioMin: 540, fimMin: 1200 }, // trabalha, mas a unidade não abre segunda
    ];
    expect(horarioDaUnidade(exp, [2, 3, 4, 5, 6])).toEqual([
      { dias: 'Terça a sexta', horario: '9h às 20h' },
      { dias: 'Sábado', horario: '8h às 18h' },
      { dias: 'Segunda e domingo', horario: null },
    ]);
    expect(horarioDaUnidade([], [1])).toEqual([
      { dias: 'Segunda, terça, quarta, quinta, sexta, sábado e domingo', horario: null },
    ]);
    expect(formatarMinutos(570)).toBe('9h30');
  });

  it('nota só aparece com avaliações suficientes', () => {
    expect(notaDoSite([5, 5, 4, 5])).toBeNull();
    expect(notaDoSite([5, 5, 4, 5, 5, 0])).toEqual({ media: 4.8, total: 5 });
  });

  it('links do mapa e do WhatsApp', () => {
    expect(linkDoMapa('Rua A, 1')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20A%2C%201',
    );
    expect(linkWhatsappDaUnidade('(19) 99999-0000')).toBe('https://wa.me/5519999990000');
    expect(linkWhatsappDaUnidade('123')).toBeNull();
    expect(linkWhatsappDaUnidade(null)).toBeNull();
  });

  it('serviços em destaque e por categoria (extras à parte)', () => {
    const s = (nome: string, categoria: string | null, ehExtra = false) => ({
      id: nome,
      nome,
      categoria,
      duracaoMin: 30,
      preco: 1000,
      ehExtra,
    });
    const lista = [
      s('Corte', 'Cabelo'),
      s('Hidratação', null, true),
      s('Barba', 'Barba'),
      s('Pezinho', 'Cabelo'),
      s('Platinado', null),
    ];
    expect(servicosEmDestaque(lista).map((x) => x.nome)).toEqual(['Corte', 'Barba', 'Pezinho']);
    expect(servicosPorCategoria(lista).map((g) => [g.nome, g.itens.length])).toEqual([
      ['Cabelo', 2],
      ['Barba', 1],
      ['Serviços', 1],
      ['Adicionais', 1],
    ]);
  });
});

describe('operações do painel (lote 7b)', () => {
  const base = siteInicial('Navalha');
  const tipos = (s: ReturnType<typeof siteInicial>, p: 'inicio' | 'contato' = 'inicio') =>
    s.paginas[p].map((b) => b.tipo);

  it('move para cima e para baixo, parando nas pontas', () => {
    const s = moverBloco(base, 'inicio', 'sobre', -1);
    expect(tipos(s).slice(0, 3)).toEqual(['banner', 'sobre', 'destaques']);
    expect(moverBloco(base, 'inicio', 'banner', -1)).toBe(base);
    expect(moverBloco(base, 'inicio', 'agendar', 1)).toBe(base);
  });

  it('edita, esconde, remove e põe de volta com o texto sugerido, antes da faixa de agendar', () => {
    let s = editarBloco(base, 'inicio', 'sobre', { titulo: 'Nossa casa', visivel: false });
    expect(s.paginas.inicio.find((b) => b.id === 'sobre')).toMatchObject({
      titulo: 'Nossa casa',
      visivel: false,
    });
    s = removerBloco(s, 'inicio', 'sobre');
    expect(blocosParaAdicionar(s, 'inicio')).toEqual(['sobre']);
    s = adicionarBloco(s, 'inicio', 'sobre', 'Navalha');
    expect(tipos(s).slice(-2)).toEqual(['sobre', 'agendar']);
    expect(s.paginas.inicio.find((b) => b.tipo === 'sobre')?.titulo).toBe('Conheça a Navalha');
    expect(siteBarbeariaSchema.safeParse(s).success).toBe(true);
  });

  it('não repete bloco nem põe bloco de outra página', () => {
    expect(blocosParaAdicionar(base, 'inicio')).toEqual([]);
    expect(adicionarBloco(base, 'inicio', 'tabela', 'X')).toBe(base);
    const sem = removerBloco(base, 'contato', 'perguntas');
    expect(blocosParaAdicionar(sem, 'contato')).toEqual(['perguntas']);
  });
});

describe('fotos do site (lote 7c)', () => {
  const f1 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
  const f2 = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';

  it('lista as fotos usadas, sem repetir', () => {
    const base = siteInicial('X');
    let s = editarBloco(base, 'inicio', 'banner', { foto: f1 });
    s = editarBloco(s, 'inicio', 'galeria', {
      itens: [
        { titulo: 'Degradê', texto: '', foto: f2 },
        { titulo: 'De novo', texto: '', foto: f1 },
      ],
    });
    s = { ...s, logo: f2 };
    expect(fotosDoSite(s).sort()).toEqual([f1, f2].sort());
    expect(siteBarbeariaSchema.safeParse(s).success).toBe(true);
    expect(fotosDoSite(base)).toEqual([]);
  });

  it('o rascunho gravado antes das fotos continua valendo', () => {
    const antigo = siteInicial('X') as Record<string, unknown>;
    delete antigo.logo;
    const paginas = antigo.paginas as { inicio: { tipo: string }[] };
    paginas.inicio = paginas.inicio.filter((b) => b.tipo !== 'galeria');
    const lido = lerSite(antigo, 'Outro nome');
    expect(lido.paginas.inicio.some((b) => b.tipo === 'galeria')).toBe(false);
    expect(lido.paginas.inicio[2]?.titulo).toBe('Conheça a X');
  });

  it('endereço e nome do arquivo da foto', () => {
    expect(urlDaFoto(f1)).toBe(`/f/${f1}-1600.webp`);
    expect(urlDaFoto(f1, 640)).toBe(`/f/${f1}-640.webp`);
    expect(NOME_ARQUIVO_FOTO.test(`${f1}-640.webp`)).toBe(true);
    expect(NOME_ARQUIVO_FOTO.test(`${f1}-800.webp`)).toBe(false);
    expect(NOME_ARQUIVO_FOTO.test(`../${f1}-640.webp`)).toBe(false);
  });

  it('envio aceita base64 de imagem pequena e recusa o resto', () => {
    expect(envioFotoSchema.safeParse({ tipo: 'image/webp', dados: 'UklGRg==' }).success).toBe(true);
    expect(envioFotoSchema.safeParse({ tipo: 'image/gif', dados: 'R0lG' }).success).toBe(false);
    expect(envioFotoSchema.safeParse({ tipo: 'image/png', dados: 'não é base64' }).success).toBe(
      false,
    );
    expect(
      envioFotoSchema.safeParse({ tipo: 'image/jpeg', dados: 'A'.repeat(1_000_000) }).success,
    ).toBe(false);
  });
});

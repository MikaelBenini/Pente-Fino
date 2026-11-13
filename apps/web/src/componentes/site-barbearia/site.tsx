// Site da barbearia, tema Tradicional (seção 7, lote 7a; modelo aprovado pelo dono em 13/11).
// Componentes só de apresentação, sem estado: servem à página pública (no servidor) e à prévia
// do painel. Cada faixa é um bloco que o dono liga, desliga e reordena.
import {
  CAMINHO_PAGINA,
  CORES_SITE,
  PAGINAS_SITE,
  ROTULO_PAGINA,
  blocosVisiveis,
  formatarMoeda,
  linkDoMapa,
  servicosEmDestaque,
  servicosPorCategoria,
  urlDaFoto,
  type BlocoSite,
  type PaginaSite,
  type SitePublico,
} from '@pente-fino/shared';
import { CalendarCheck, Clock, MapPin, Menu, MessageCircle, Star } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { CLASSES_FONTES, FONTE_TITULO } from './fontes';

// Paleta do tema: verde-garrafa, papel e tinta. O destaque é a cor que o dono escolhe.
const VERDE = 'bg-[#14271C]';
const TITULO = 'font-[family-name:var(--site-titulo)] font-normal';
const BOTAO =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--site-raio)] px-6 py-3 font-semibold transition-[filter] duration-[var(--ritmo-rapido)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2';
const BOTAO_DESTAQUE = `${BOTAO} bg-[var(--site-destaque)] text-[#14271C] focus-visible:outline-[var(--site-destaque)]`;
const LARGURA = 'mx-auto w-full max-w-6xl px-4 @2xl:px-6';

const RAIO = { retos: '0px', arredondados: '8px', pilula: '999px' } as const;

const IGNORAR = new Set([
  'barbearia',
  'barber',
  'barbershop',
  'shop',
  'do',
  'da',
  'de',
  'dos',
  'das',
  'the',
]);
/** Letra do monograma: a primeira palavra que não é "barbearia", "do"… ("Barbearia do Carlos" → C). */
export function inicialDoNome(nome: string): string {
  const palavras = nome.trim().split(/\s+/);
  const p = palavras.find((w) => !IGNORAR.has(w.toLowerCase())) ?? palavras[0] ?? '';
  return (p.charAt(0) || '?').toUpperCase();
}

function duracao(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface Props {
  dados: SitePublico;
  pagina: PaginaSite;
  /** Começo dos links do site: "/b/<slug>". */
  base: string;
}

export function SiteDaBarbearia({ dados, pagina, base }: Props) {
  const { site } = dados;
  const blocos = blocosVisiveis(site, pagina);
  const estilo = {
    '--site-destaque': CORES_SITE[site.cor].hex,
    '--site-titulo': FONTE_TITULO[site.fonte],
    '--site-raio': RAIO[site.botoes],
  } as CSSProperties;
  const temH1 = blocos.some((b) => b.tipo === 'banner' || b.tipo === 'cabecalho');
  return (
    <div
      className={`${CLASSES_FONTES} @container min-h-dvh bg-[#F5F4F0] font-[family-name:var(--site-fonte-texto)] text-[17px] leading-relaxed text-[#1A221D]`}
      style={estilo}
    >
      <Cabecalho dados={dados} pagina={pagina} base={base} />
      <main>
        {!temH1 && (
          <h1 className="sr-only">
            {ROTULO_PAGINA[pagina]}: {dados.barbearia}
          </h1>
        )}
        {blocos.map((b) => (
          <Bloco key={b.id} bloco={b} dados={dados} base={base} />
        ))}
      </main>
      <Rodape dados={dados} base={base} />
    </div>
  );
}

function Monograma({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--site-destaque)] text-[var(--site-destaque)] ${TITULO} ${className ?? ''}`}
    >
      {inicialDoNome(nome)}
    </span>
  );
}

/** Foto enviada pelo dono, nos dois tamanhos guardados; a medida evita a página pular. */
function Foto({
  id,
  dados,
  alt,
  className,
  tamanhos = '100vw',
  prioridade = false,
}: {
  id: string;
  dados: SitePublico;
  alt: string;
  className?: string;
  tamanhos?: string;
  prioridade?: boolean;
}) {
  const medida = dados.fotos[id];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- já vem reduzida e em WebP da API
    <img
      src={urlDaFoto(id, 1600)}
      srcSet={`${urlDaFoto(id, 640)} 640w, ${urlDaFoto(id, 1600)} 1600w`}
      sizes={tamanhos}
      width={medida?.largura}
      height={medida?.altura}
      alt={alt}
      loading={prioridade ? 'eager' : 'lazy'}
      fetchPriority={prioridade ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  );
}

function Cabecalho({ dados, pagina, base }: Props) {
  const links = PAGINAS_SITE.map((p) => ({
    p,
    href: `${base}${CAMINHO_PAGINA[p]}`,
    rotulo: ROTULO_PAGINA[p],
  }));
  const agendar = (
    <Link href={`${base}/agendar`} className={BOTAO_DESTAQUE}>
      Agendar horário
    </Link>
  );
  return (
    <header className={`${VERDE} text-[#F2F1EC]`}>
      <div className={`${LARGURA} flex items-center justify-between gap-4 py-4`}>
        <Link href={base || '/'} className="flex min-h-11 items-center gap-3 text-[#F2F1EC]">
          {dados.site.logo ? (
            <Foto
              id={dados.site.logo}
              dados={dados}
              alt=""
              tamanhos="160px"
              prioridade
              className="h-11 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <Monograma nome={dados.barbearia} className="size-11 text-[22px]" />
          )}
          <span className={`${TITULO} text-[22px] leading-tight @2xl:text-[24px]`}>
            {dados.barbearia}
          </span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 @3xl:flex">
          {links.map((l) => (
            <Link
              key={l.p}
              href={l.href}
              aria-current={l.p === pagina ? 'page' : undefined}
              className={`border-b-2 py-1.5 ${l.p === pagina ? 'border-[var(--site-destaque)] text-white' : 'border-transparent text-[#C9D2CB] hover:text-white'}`}
            >
              {l.rotulo}
            </Link>
          ))}
          {agendar}
        </nav>
        <details className="group relative @3xl:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--site-raio)] border border-[#4E6A57] px-4 [&::-webkit-details-marker]:hidden">
            <Menu aria-hidden className="size-5" strokeWidth={1.75} />
            Menu
          </summary>
          <nav
            aria-label="Principal"
            className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-1 bg-[#14271C] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
          >
            {links.map((l) => (
              <Link
                key={l.p}
                href={l.href}
                aria-current={l.p === pagina ? 'page' : undefined}
                className={`flex min-h-11 items-center px-3 ${l.p === pagina ? 'text-white underline decoration-[var(--site-destaque)] decoration-2 underline-offset-4' : 'text-[#C9D2CB]'}`}
              >
                {l.rotulo}
              </Link>
            ))}
            <div className="mt-2">{agendar}</div>
          </nav>
        </details>
      </div>
    </header>
  );
}

function Bloco({ bloco, dados, base }: { bloco: BlocoSite; dados: SitePublico; base: string }) {
  switch (bloco.tipo) {
    case 'banner':
      return <Banner bloco={bloco} dados={dados} base={base} />;
    case 'destaques':
      return <Destaques dados={dados} />;
    case 'sobre':
      return <Sobre bloco={bloco} dados={dados} base={base} />;
    case 'servicos':
      return <ServicosDestaque bloco={bloco} dados={dados} base={base} />;
    case 'equipe':
      return <EquipeResumo bloco={bloco} dados={dados} base={base} />;
    case 'galeria':
      return <Galeria bloco={bloco} dados={dados} />;
    case 'depoimentos':
      return <Depoimentos bloco={bloco} />;
    case 'cabecalho':
      return <CabecalhoPagina bloco={bloco} />;
    case 'tabela':
      return <TabelaServicos dados={dados} base={base} />;
    case 'barbeiros':
      return <Barbeiros dados={dados} base={base} />;
    case 'contato':
      return <Contato dados={dados} />;
    case 'perguntas':
      return <Perguntas bloco={bloco} />;
    case 'agendar':
      return <FaixaAgendar bloco={bloco} base={base} />;
  }
}

function Titulo2({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`${TITULO} text-[40px] leading-[1.05] @2xl:text-[52px] ${className ?? ''}`}>
      {children}
    </h2>
  );
}

function Banner({ bloco, dados, base }: { bloco: BlocoSite; dados: SitePublico; base: string }) {
  return (
    <section className={`${VERDE} relative overflow-hidden text-white`}>
      {bloco.foto ? (
        <>
          <Foto
            id={bloco.foto}
            dados={dados}
            alt={`Foto da ${dados.barbearia}`}
            prioridade
            className="absolute inset-0 size-full object-cover"
          />
          {/* Véu escuro embaixo, onde fica o texto: leitura garantida em qualquer foto. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,39,28,0.92)_0%,rgba(20,39,28,0.7)_45%,rgba(20,39,28,0.25)_100%)]"
          />
        </>
      ) : (
        <span
          aria-hidden
          className={`${TITULO} pointer-events-none absolute -right-8 -bottom-24 text-[22rem] leading-none text-[var(--site-destaque)] opacity-[0.07] select-none @2xl:text-[34rem]`}
        >
          {inicialDoNome(dados.barbearia)}
        </span>
      )}
      <div
        className={`${LARGURA} relative flex min-h-[540px] flex-col justify-end gap-7 pt-28 pb-20 motion-safe:animate-[entrar_var(--ritmo-lento)_var(--curva-saida)_both]`}
      >
        <h1
          className={`${TITULO} max-w-[11em] text-[44px] leading-none @2xl:text-[72px] @5xl:text-[88px]`}
        >
          {bloco.titulo || dados.barbearia}
        </h1>
        {bloco.texto && (
          <p className="max-w-[32em] text-[19px] whitespace-pre-line text-[#DCE4DE] @2xl:text-[20px]">
            {bloco.texto}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href={`${base}/agendar`} className={`${BOTAO_DESTAQUE} text-[18px]`}>
            Agendar horário
          </Link>
          <Link
            href={`${base}/servicos`}
            className={`${BOTAO} border border-white text-[18px] text-white focus-visible:outline-white`}
          >
            Ver serviços e preços
          </Link>
        </div>
      </div>
    </section>
  );
}

function Destaques({ dados }: { dados: SitePublico }) {
  const itens: { icone: ReactNode; titulo: string; texto: string }[] = [];
  const icone = 'size-7 shrink-0 text-[#1F5135]';
  if (dados.nota)
    itens.push({
      icone: <Star aria-hidden className="size-7 shrink-0 fill-[#B48C3C] text-[#B48C3C]" />,
      titulo: `Nota ${dados.nota.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}`,
      texto: `em ${dados.nota.total} avaliações de clientes`,
    });
  itens.push({
    icone: <CalendarCheck aria-hidden className={icone} strokeWidth={1.75} />,
    titulo: 'Agende pelo site',
    texto: 'a qualquer hora, em menos de um minuto',
  });
  if (dados.endereco)
    itens.push({
      icone: <MapPin aria-hidden className={icone} strokeWidth={1.75} />,
      titulo: dados.unidade,
      texto: dados.endereco,
    });
  const aberto = dados.horario.find((h) => h.horario);
  if (aberto)
    itens.push({
      icone: <Clock aria-hidden className={icone} strokeWidth={1.75} />,
      titulo: aberto.dias,
      texto: aberto.horario!,
    });
  return (
    <section aria-label="Destaques" className="border-b border-[#E2E1DA] bg-white">
      <ul
        className={`${LARGURA} grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5 py-7`}
      >
        {itens.map((i) => (
          <li key={i.titulo} className="flex items-center gap-3.5">
            {i.icone}
            <span className="min-w-0">
              <strong className="block">{i.titulo}</strong>
              <span className="block text-[15px] text-[#4C554F]">{i.texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sobre({ bloco, dados, base }: { bloco: BlocoSite; dados: SitePublico; base: string }) {
  if (!bloco.titulo && !bloco.texto) return null;
  if (bloco.foto)
    return (
      <section
        className={`${LARGURA} flex flex-col gap-12 py-24 @3xl:flex-row @3xl:items-center @3xl:gap-16 @2xl:py-28`}
      >
        <Foto
          id={bloco.foto}
          dados={dados}
          alt={bloco.titulo ?? `Foto da ${dados.barbearia}`}
          tamanhos="(min-width: 768px) 50vw, 100vw"
          className="aspect-[5/4] w-full object-cover @3xl:w-1/2"
        />
        <div className="flex min-w-0 flex-col gap-5 @3xl:w-1/2">
          {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
          {bloco.texto && (
            <p className="text-[19px] whitespace-pre-line text-[#3E4842]">{bloco.texto}</p>
          )}
          <Link
            href={`${base}/equipe`}
            className="self-start font-semibold text-[#1F5135] underline-offset-4 hover:underline"
          >
            Conheça a equipe
          </Link>
        </div>
      </section>
    );
  return (
    <section className={`${LARGURA} py-24 @2xl:py-28`}>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 text-center">
        {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
        {bloco.texto && (
          <p className="text-[19px] whitespace-pre-line text-[#3E4842]">{bloco.texto}</p>
        )}
        <Link
          href={`${base}/equipe`}
          className="font-semibold text-[#1F5135] underline-offset-4 hover:underline"
        >
          Conheça a equipe
        </Link>
      </div>
    </section>
  );
}

function ServicosDestaque({
  bloco,
  dados,
  base,
}: {
  bloco: BlocoSite;
  dados: SitePublico;
  base: string;
}) {
  const lista = servicosEmDestaque(dados.servicos);
  if (!lista.length) return null;
  return (
    <section className="bg-white">
      <div className={`${LARGURA} flex flex-col gap-11 py-24 @2xl:py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Titulo2>{bloco.titulo || 'Serviços'}</Titulo2>
          <Link
            href={`${base}/servicos`}
            className="font-semibold text-[#1F5135] underline-offset-4 hover:underline"
          >
            Ver todos os serviços
          </Link>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-6">
          {lista.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 border-t-2 border-[#14271C] pt-6">
              <h3 className={`${TITULO} text-[30px] leading-tight`}>{s.nome}</h3>
              <p className="text-[#4C554F]">{duracao(s.duracaoMin)}</p>
              <p className={`${TITULO} text-[36px] leading-none`}>{formatarMoeda(s.preco)}</p>
              <Link
                href={`${base}/agendar`}
                className="mt-1 font-semibold text-[#1F5135] underline-offset-4 hover:underline"
              >
                Agendar {s.nome.toLowerCase()}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function EquipeResumo({
  bloco,
  dados,
  base,
}: {
  bloco: BlocoSite;
  dados: SitePublico;
  base: string;
}) {
  if (!dados.equipe.length) return null;
  return (
    <section className={`${VERDE} text-[#F2F1EC]`}>
      <div className={`${LARGURA} flex flex-col gap-12 py-24 @2xl:py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Titulo2>{bloco.titulo || 'A equipe'}</Titulo2>
          <Link
            href={`${base}/equipe`}
            className="font-semibold text-[var(--site-destaque)] underline-offset-4 hover:underline"
          >
            Ver a equipe
          </Link>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-10">
          {dados.equipe.map((p) => (
            <li key={p.id} className="flex items-center gap-5">
              {dados.site.equipe[p.id]?.foto ? (
                <Foto
                  id={dados.site.equipe[p.id]!.foto!}
                  dados={dados}
                  alt={`Foto de ${p.nome}`}
                  tamanhos="96px"
                  className="size-24 shrink-0 rounded-full border-2 border-[var(--site-destaque)] object-cover"
                />
              ) : (
                <Monograma nome={p.nome} className="size-24 border-2 text-[44px]" />
              )}
              <div className="min-w-0">
                <h3 className={`${TITULO} text-[30px] leading-tight`}>{p.nome}</h3>
                {p.foco && <p className="text-[#C9D2CB]">{p.foco}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Galeria({ bloco, dados }: { bloco: BlocoSite; dados: SitePublico }) {
  const itens = (bloco.itens ?? []).filter((i) => i.foto);
  if (!itens.length) return null;
  return (
    <section className="bg-white">
      <div className={`${LARGURA} flex flex-col gap-11 py-24 @2xl:py-28`}>
        {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
        <ul className="grid grid-cols-2 gap-2 @3xl:grid-cols-3">
          {itens.map((f, i) => (
            <li key={`${f.foto}-${i}`}>
              <figure className="relative">
                <Foto
                  id={f.foto!}
                  dados={dados}
                  alt={f.titulo || `Trabalho da ${dados.barbearia}`}
                  tamanhos="(min-width: 768px) 33vw, 50vw"
                  className="aspect-square w-full object-cover"
                />
                {f.titulo && (
                  <figcaption className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] bg-[#14271C] px-2.5 py-1 text-[14px] text-white">
                    {f.titulo}
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Depoimentos({ bloco }: { bloco: BlocoSite }) {
  const itens = (bloco.itens ?? []).filter((i) => i.texto);
  if (!itens.length) return null;
  return (
    <section className={`${LARGURA} flex flex-col gap-11 py-24 @2xl:py-28`}>
      {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
        {itens.map((d, i) => (
          <figure
            key={i}
            className="flex flex-col gap-4 border-t-[3px] border-[var(--site-destaque)] bg-white p-8"
          >
            <blockquote className={`${TITULO} text-[23px] leading-snug whitespace-pre-line`}>
              “{d.texto}”
            </blockquote>
            {d.titulo && <figcaption className="text-[15px] text-[#4C554F]">{d.titulo}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

function CabecalhoPagina({ bloco }: { bloco: BlocoSite }) {
  return (
    <section className="bg-[#1C3426] text-[#F2F1EC]">
      <div
        className={`${LARGURA} flex flex-col gap-4 pt-20 pb-14 motion-safe:animate-[entrar_var(--ritmo-lento)_var(--curva-saida)_both]`}
      >
        <h1 className={`${TITULO} text-[44px] leading-none @2xl:text-[72px]`}>{bloco.titulo}</h1>
        {bloco.texto && (
          <p className="max-w-[36em] text-[19px] whitespace-pre-line text-[#C9D2CB]">
            {bloco.texto}
          </p>
        )}
      </div>
    </section>
  );
}

function TabelaServicos({ dados, base }: { dados: SitePublico; base: string }) {
  const grupos = servicosPorCategoria(dados.servicos);
  if (!grupos.length)
    return (
      <section className={`${LARGURA} py-20 text-[#4C554F]`}>
        Os serviços aparecem aqui assim que tiverem preço nesta unidade.
      </section>
    );
  const ancora = (nome: string) =>
    `cat-${nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className={`${LARGURA} flex flex-col gap-16 pt-10 pb-24`}>
      {grupos.length > 1 && (
        <nav aria-label="Categorias" className="flex flex-wrap gap-2.5">
          {grupos.map((g) => (
            <a
              key={g.nome}
              href={`#${ancora(g.nome)}`}
              className="inline-flex min-h-11 items-center rounded-[var(--site-raio)] border border-[#B9BFB5] px-4 hover:border-[#14271C]"
            >
              {g.nome}
            </a>
          ))}
        </nav>
      )}
      {grupos.map((g) => (
        <section key={g.nome} id={ancora(g.nome)} className="flex scroll-mt-6 flex-col">
          <h2 className={`${TITULO} mb-4 text-[36px] leading-tight @2xl:text-[44px]`}>{g.nome}</h2>
          <ul>
            {g.itens.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[#DAD8D0] py-5"
              >
                <div className="min-w-0">
                  <h3 className="text-[20px] font-semibold">{s.nome}</h3>
                  <p className="text-[15px] text-[#4C554F]">{duracao(s.duracaoMin)}</p>
                </div>
                <div className="flex items-center gap-5">
                  <span className={`${TITULO} text-[30px] leading-none`}>
                    {formatarMoeda(s.preco)}
                  </span>
                  <Link
                    href={`${base}/agendar`}
                    aria-label={`Agendar ${s.nome}`}
                    className={`${BOTAO} border border-[#1F5135] px-4 py-2 text-[#1F5135] focus-visible:outline-[#1F5135]`}
                  >
                    Agendar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Barbeiros({ dados, base }: { dados: SitePublico; base: string }) {
  if (!dados.equipe.length) return null;
  return (
    <div className={`${LARGURA} flex flex-col gap-20 py-20 @2xl:gap-24 @2xl:py-24`}>
      {dados.equipe.map((p, i) => (
        <article
          key={p.id}
          className={`flex flex-col gap-10 @3xl:items-center ${i % 2 ? '@3xl:flex-row-reverse' : '@3xl:flex-row'}`}
        >
          {dados.site.equipe[p.id]?.foto ? (
            <Foto
              id={dados.site.equipe[p.id]!.foto!}
              dados={dados}
              alt={`Foto de ${p.nome}`}
              tamanhos="(min-width: 768px) 360px, 100vw"
              className="aspect-[4/5] w-full max-w-[360px] object-cover @3xl:flex-1"
            />
          ) : (
            <div
              aria-hidden
              className={`${VERDE} ${TITULO} flex aspect-[4/5] w-full max-w-[360px] items-center justify-center text-[160px] text-[var(--site-destaque)] @3xl:flex-1`}
            >
              {inicialDoNome(p.nome)}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-4 @3xl:flex-1">
            <div>
              <h2 className={`${TITULO} text-[48px] leading-none @2xl:text-[56px]`}>{p.nome}</h2>
              {p.foco && <p className="mt-2 text-[19px] text-[#6E5520]">{p.foco}</p>}
            </div>
            {p.sobre && (
              <p className="max-w-[32em] whitespace-pre-line text-[#3E4842]">{p.sobre}</p>
            )}
            <Link
              href={`${base}/agendar`}
              className={`${BOTAO} self-start bg-[#14271C] text-[#F2F1EC] focus-visible:outline-[#14271C]`}
            >
              Agendar com {p.nome}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function Contato({ dados }: { dados: SitePublico }) {
  return (
    <section className={`${LARGURA} grid gap-14 py-20 @3xl:grid-cols-2`}>
      <div className="flex flex-col gap-9">
        {dados.endereco && (
          <div>
            <h2 className={`${TITULO} mb-2 text-[32px]`}>Onde fica</h2>
            <p className="text-[19px]">{dados.endereco}</p>
            <a
              href={linkDoMapa(dados.endereco)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-[#1F5135] underline-offset-4 hover:underline"
            >
              <MapPin aria-hidden className="size-5" strokeWidth={1.75} />
              Abrir no Google Maps
            </a>
          </div>
        )}
        {dados.horario.length > 0 && (
          <table className="w-full max-w-md border-collapse">
            <caption className={`${TITULO} pb-2 text-left text-[32px]`}>Horário</caption>
            <tbody>
              {dados.horario.map((h) => (
                <tr key={h.dias} className="border-b border-[#DAD8D0] last:border-0">
                  <th scope="row" className="py-2.5 pr-6 text-left font-normal">
                    {h.dias}
                  </th>
                  <td className={`py-2.5 text-right ${h.horario ? '' : 'text-[#56605A]'}`}>
                    {h.horario ?? 'Fechado'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-col gap-4 self-start bg-white p-8">
        <h2 className={`${TITULO} text-[32px]`}>Fale com a gente</h2>
        {dados.whatsapp && (
          <a
            href={dados.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-3 font-medium text-[#1F5135] underline-offset-4 hover:underline"
          >
            <MessageCircle aria-hidden className="size-5" strokeWidth={1.75} />
            WhatsApp
          </a>
        )}
        {dados.site.instagram && (
          <a
            href={`https://instagram.com/${dados.site.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-3 font-medium text-[#1F5135] underline-offset-4 hover:underline"
          >
            <IconeInstagram className="size-5" />
            Instagram @{dados.site.instagram}
          </a>
        )}
        {!dados.whatsapp && !dados.site.instagram && (
          <p className="text-[#4C554F]">
            Agende pelo botão abaixo; a confirmação chega no seu WhatsApp.
          </p>
        )}
      </div>
    </section>
  );
}

function Perguntas({ bloco }: { bloco: BlocoSite }) {
  const itens = (bloco.itens ?? []).filter((i) => i.titulo && i.texto);
  if (!itens.length) return null;
  return (
    <section className="bg-white">
      <div className="mx-auto flex max-w-3xl flex-col px-4 py-20 @2xl:px-6">
        {bloco.titulo && (
          <Titulo2 className="mb-6 text-[36px] @2xl:text-[44px]">{bloco.titulo}</Titulo2>
        )}
        {itens.map((q, i) => (
          <details key={i} className="group border-b border-[#DAD8D0] py-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[19px] font-semibold [&::-webkit-details-marker]:hidden">
              {q.titulo}
              <span
                aria-hidden
                className="text-[24px] leading-none text-[#4C554F] transition-transform duration-[var(--ritmo)] group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-[#3E4842]">{q.texto}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FaixaAgendar({ bloco, base }: { bloco: BlocoSite; base: string }) {
  return (
    <section className="bg-[var(--site-destaque)] text-[#14271C]">
      <div className={`${LARGURA} flex flex-wrap items-center justify-between gap-6 py-16`}>
        <div className="max-w-2xl">
          <p className={`${TITULO} text-[34px] leading-tight @2xl:text-[42px]`}>
            {bloco.titulo || 'Marque seu horário'}
          </p>
          {bloco.texto && <p className="mt-1.5 whitespace-pre-line">{bloco.texto}</p>}
        </div>
        <Link
          href={`${base}/agendar`}
          className={`${BOTAO} bg-[#14271C] text-[18px] text-[#F2F1EC] focus-visible:outline-[#14271C]`}
        >
          Agendar horário
        </Link>
      </div>
    </section>
  );
}

function Rodape({ dados, base }: { dados: SitePublico; base: string }) {
  const link = 'text-[#C9D2CB] underline-offset-4 hover:text-white hover:underline';
  return (
    <footer className="bg-[#0F1E15] text-[#C9D2CB]">
      <div
        className={`${LARGURA} grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-10 pt-16 pb-10`}
      >
        <div className="flex flex-col gap-2">
          <span className={`${TITULO} text-[24px] text-[#F2F1EC]`}>{dados.barbearia}</span>
          {dados.site.slogan && <span>{dados.site.slogan}</span>}
        </div>
        {dados.endereco && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[#F2F1EC]">Endereço</strong>
            <span>{dados.endereco}</span>
            <Link
              href={`${base}/contato`}
              className="text-[var(--site-destaque)] underline-offset-4 hover:underline"
            >
              Como chegar
            </Link>
          </div>
        )}
        {dados.horario.some((h) => h.horario) && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[#F2F1EC]">Horário</strong>
            {dados.horario
              .filter((h) => h.horario)
              .map((h) => (
                <span key={h.dias}>
                  {h.dias}, {h.horario}
                </span>
              ))}
          </div>
        )}
        {(dados.whatsapp || dados.site.instagram) && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[#F2F1EC]">Fale com a gente</strong>
            {dados.whatsapp && (
              <a href={dados.whatsapp} target="_blank" rel="noopener noreferrer" className={link}>
                WhatsApp
              </a>
            )}
            {dados.site.instagram && (
              <a
                href={`https://instagram.com/${dados.site.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                Instagram
              </a>
            )}
          </div>
        )}
      </div>
      <div
        className={`${LARGURA} flex flex-wrap justify-between gap-3 border-t border-[#22372A] pt-5 pb-8 text-[14px] text-[#8FA095]`}
      >
        <span>{dados.barbearia}</span>
        <Link href="/" className="hover:text-white">
          Site e agenda pelo Pente Fino
        </Link>
      </div>
    </footer>
  );
}

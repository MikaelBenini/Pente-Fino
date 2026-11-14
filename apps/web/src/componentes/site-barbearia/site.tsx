// Site da barbearia, tema Tradicional (seção 7, lote 7a; modelo aprovado pelo dono em 13/11).
// Componentes só de apresentação, sem estado: servem à página pública (no servidor) e à prévia
// do painel. Cada faixa é um bloco que o dono liga, desliga e reordena.
import {
  CAMINHO_PAGINA,
  caminhoDoAgendamento,
  CORES_SITE,
  PALETAS_SITE,
  ROTULO_PAGINA,
  blocosVisiveis,
  cabecalhoDoSite,
  limparCssSite,
  rodapeDoSite,
  urlDeLinkValida,
  formatarMoeda,
  linkDoMapa,
  quemFaz,
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
const VERDE = 'bg-[var(--site-escuro)]';
const TITULO = 'font-[family-name:var(--site-titulo)] font-normal';
const BOTAO =
  'site-botao inline-flex min-h-11 items-center justify-center rounded-[var(--site-raio)] px-6 py-3 font-semibold transition-[filter] duration-[var(--ritmo-rapido)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2';
const BOTAO_DESTAQUE = `${BOTAO} bg-[var(--site-destaque)] text-[var(--site-escuro)] focus-visible:outline-[var(--site-destaque)]`;
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
  /** Começo dos links do site: "/s/<endereço>", ou "" no domínio próprio da barbearia. */
  base: string;
  /** Para onde vão os botões "Agendar": o link /b/<link>, ou /agendar no domínio próprio. */
  agendar?: string;
}

/** Dados do site com o destino do "Agendar" já resolvido (lote 7e). */
type DadosDoSite = SitePublico & { linkAgendar?: string };
const linkAgendar = (dados: SitePublico) =>
  (dados as DadosDoSite).linkAgendar ??
  (dados.slugAgendamento ? caminhoDoAgendamento(dados.slugAgendamento) : '');
/** O site pode estar no ar sem o link de agendamento ligado (decisão do dono, 13/11). */
const temAgendamento = (dados: SitePublico) => linkAgendar(dados) !== '';

/**
 * Botão principal: "Agendar horário" com o link ligado; sem ele, "Falar no WhatsApp" (telefone
 * da unidade); sem os dois, nada.
 */
function AcaoPrincipal({ dados, className }: { dados: SitePublico; className: string }) {
  if (temAgendamento(dados))
    return (
      <Link href={linkAgendar(dados)} className={className}>
        {cabecalhoDoSite(dados.site).botao || 'Agendar horário'}
      </Link>
    );
  if (dados.whatsapp)
    return (
      <a href={dados.whatsapp} target="_blank" rel="noopener noreferrer" className={className}>
        Falar no WhatsApp
      </a>
    );
  return null;
}

export function SiteDaBarbearia({ dados: brutos, pagina, base, agendar }: Props) {
  const dados: DadosDoSite = agendar ? { ...brutos, linkAgendar: agendar } : brutos;
  const { site } = dados;
  const blocos = blocosVisiveis(site, pagina);
  const paleta = PALETAS_SITE[site.tema] ?? PALETAS_SITE.tradicional;
  const estilo = {
    ...Object.fromEntries(
      Object.entries(paleta).map(([k, v]) => [
        `--site-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
        v,
      ]),
    ),
    '--site-destaque': CORES_SITE[site.cor].hex,
    '--site-titulo': FONTE_TITULO[site.fonte],
    '--site-raio': RAIO[site.botoes],
  } as CSSProperties;
  const temH1 = blocos.some((b) => b.tipo === 'banner' || b.tipo === 'cabecalho');
  const css = limparCssSite(site.css);
  return (
    <div
      className={`${CLASSES_FONTES} site-personalizado site-tema-${site.tema} @container min-h-dvh bg-[var(--site-papel)] font-[family-name:var(--site-fonte-texto)] text-[17px] leading-relaxed text-[var(--site-tinta)]`}
      style={estilo}
    >
      {css && (
        // CSS do dono, já limpo (limparCssSite) e preso ao site dele por aninhamento.
        <style dangerouslySetInnerHTML={{ __html: `.site-personalizado{${css}}` }} />
      )}
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
  const config = cabecalhoDoSite(dados.site);
  const links = config.menu
    .filter((m) => m.visivel)
    .map((m) => ({
      p: m.pagina,
      href: `${base}${CAMINHO_PAGINA[m.pagina]}` || '/',
      rotulo: m.rotulo || ROTULO_PAGINA[m.pagina],
    }));
  const extras = config.links.map((l) => (
    <a
      key={l.url}
      href={l.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center px-3 text-[var(--site-claro-suave)] hover:text-white @3xl:min-h-0 @3xl:px-0 @3xl:py-1.5"
    >
      {l.rotulo}
    </a>
  ));
  const mostraLogo = config.mostrar !== 'nome';
  const mostraNome = config.mostrar !== 'logo' || !dados.site.logo;
  const agendar = <AcaoPrincipal dados={dados} className={BOTAO_DESTAQUE} />;
  return (
    <header className={`${VERDE} site-cabecalho sticky top-0 z-30 text-[var(--site-claro)]`}>
      <div className={`${LARGURA} flex items-center justify-between gap-4 py-4`}>
        <Link
          href={base || '/'}
          className="flex min-h-11 items-center gap-3 text-[var(--site-claro)]"
        >
          {mostraLogo &&
            (dados.site.logo ? (
              <Foto
                id={dados.site.logo}
                dados={dados}
                alt={mostraNome ? '' : dados.barbearia}
                tamanhos="160px"
                prioridade
                className="h-11 w-auto max-w-[140px] object-contain"
              />
            ) : (
              <Monograma nome={dados.barbearia} className="size-11 text-[22px]" />
            ))}
          {mostraNome && (
            <span className={`${TITULO} line-clamp-2 text-[18px] leading-tight @2xl:text-[24px]`}>
              {dados.barbearia}
            </span>
          )}
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 @3xl:flex">
          {links.map((l) => (
            <Link
              key={l.p}
              href={l.href}
              aria-current={l.p === pagina ? 'page' : undefined}
              className={`border-b-2 py-1.5 ${l.p === pagina ? 'border-[var(--site-destaque)] text-white' : 'border-transparent text-[var(--site-claro-suave)] hover:text-white'}`}
            >
              {l.rotulo}
            </Link>
          ))}
          {extras}
          {agendar}
        </nav>
        <details className="group relative @3xl:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--site-raio)] border border-[var(--site-escuro-borda)] px-4 [&::-webkit-details-marker]:hidden">
            <Menu aria-hidden className="size-5" strokeWidth={1.75} />
            Menu
          </summary>
          <nav
            aria-label="Principal"
            className="absolute right-0 z-20 mt-2 flex w-60 flex-col gap-1 bg-[var(--site-escuro)] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
          >
            {links.map((l) => (
              <Link
                key={l.p}
                href={l.href}
                aria-current={l.p === pagina ? 'page' : undefined}
                className={`flex min-h-11 items-center px-3 ${l.p === pagina ? 'text-white underline decoration-[var(--site-destaque)] decoration-2 underline-offset-4' : 'text-[var(--site-claro-suave)]'}`}
              >
                {l.rotulo}
              </Link>
            ))}
            {extras}
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
    case 'botoes':
      return <BotoesComLink bloco={bloco} />;
    case 'planos':
      return <PlanosDoClube dados={dados} />;
    case 'cabecalho':
      return <CabecalhoPagina bloco={bloco} />;
    case 'tabela':
      return <TabelaServicos dados={dados} />;
    case 'barbeiros':
      return <Barbeiros dados={dados} />;
    case 'contato':
      return <Contato dados={dados} />;
    case 'perguntas':
      return <Perguntas bloco={bloco} />;
    case 'agendar':
      return <FaixaAgendar bloco={bloco} dados={dados} />;
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
          <div className="site-parallax absolute inset-0">
            <Foto
              id={bloco.foto}
              dados={dados}
              alt={`Foto da ${dados.barbearia}`}
              prioridade
              className="site-zoom size-full object-cover"
            />
          </div>
          {/* Véu escuro embaixo, onde fica o texto: leitura garantida em qualquer foto. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_top,color-mix(in_srgb,var(--site-escuro)_92%,transparent)_0%,color-mix(in_srgb,var(--site-escuro)_70%,transparent)_45%,color-mix(in_srgb,var(--site-escuro)_25%,transparent)_100%)]"
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
        className={`${LARGURA} site-entrada relative flex min-h-[440px] flex-col justify-end gap-7 pt-16 pb-16 @2xl:min-h-[540px] @2xl:pt-28 @2xl:pb-20`}
      >
        <h1
          className={`${TITULO} max-w-[11em] text-[44px] leading-none @2xl:text-[72px] @5xl:text-[88px]`}
        >
          {bloco.titulo || dados.barbearia}
        </h1>
        {bloco.texto && (
          <p className="max-w-[32em] text-[19px] whitespace-pre-line text-[var(--site-claro-suave)] @2xl:text-[20px]">
            {bloco.texto}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <AcaoPrincipal dados={dados} className={`${BOTAO_DESTAQUE} text-[18px]`} />
          <Link
            href={`${base}/servicos`}
            className={`${BOTAO} border border-white text-[18px] text-white focus-visible:outline-white`}
          >
            Ver serviços e preços
          </Link>
        </div>
      </div>
      <FaixaServicos dados={dados} />
    </section>
  );
}

/**
 * Faixa de serviços e preços correndo embaixo do banner (lote 7f). Para ao passar o mouse, ao
 * focar e no botão "Pausar" (quem não usa mouse também consegue parar o movimento).
 */
function FaixaServicos({ dados }: { dados: SitePublico }) {
  const itens = dados.servicos.filter((s) => !s.ehExtra).slice(0, 8);
  if (itens.length < 2) return null;
  const lista = (copia: boolean) => (
    <ul aria-hidden={copia || undefined} className="flex shrink-0 items-center gap-10 pr-10">
      {itens.map((s) => (
        <li key={s.id} className="flex items-baseline gap-3 whitespace-nowrap">
          <span className={`${TITULO} text-[22px]`}>{s.nome}</span>
          <span className="font-semibold text-[var(--site-destaque)]">
            {formatarMoeda(s.preco)}
          </span>
          <span
            aria-hidden
            className="ml-7 size-1.5 self-center rounded-full bg-[var(--site-cartao)]/40"
          />
        </li>
      ))}
    </ul>
  );
  return (
    <section
      aria-label="Serviços e preços"
      className="site-faixa relative overflow-hidden border-t border-white/15 bg-black/25 py-4"
    >
      <input id="pausar-faixa" type="checkbox" className="peer sr-only" />
      <div className="site-faixa-trilho flex w-max peer-checked:[animation-play-state:paused]">
        {lista(false)}
        {lista(true)}
      </div>
      <label
        htmlFor="pausar-faixa"
        className="absolute top-1/2 right-2 flex min-h-11 -translate-y-1/2 cursor-pointer items-center rounded-[var(--site-raio)] bg-[var(--site-escuro)] px-3 text-[13px] text-[var(--site-claro-suave)] peer-focus-visible:outline-2 peer-focus-visible:outline-white"
      >
        Pausar
      </label>
    </section>
  );
}

function Destaques({ dados }: { dados: SitePublico }) {
  const itens: { icone: ReactNode; titulo: string; texto: string }[] = [];
  const icone = 'size-7 shrink-0 text-[var(--site-link)]';
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
    <section
      aria-label="Destaques"
      className="border-b border-[var(--site-linha)] bg-[var(--site-cartao)]"
    >
      <ul
        className={`${LARGURA} grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5 py-7`}
      >
        {itens.map((i) => (
          <li key={i.titulo} className="flex items-center gap-3.5">
            {i.icone}
            <span className="min-w-0">
              <strong className="block">{i.titulo}</strong>
              <span className="block text-[15px] text-[var(--site-tinta-suave)]">{i.texto}</span>
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
          className="site-revelar aspect-[5/4] w-full object-cover @3xl:w-1/2"
        />
        <div className="flex min-w-0 flex-col gap-5 @3xl:w-1/2">
          {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
          {bloco.texto && (
            <p className="text-[19px] whitespace-pre-line text-[var(--site-tinta-media)]">
              {bloco.texto}
            </p>
          )}
          <Link
            href={`${base}/equipe`}
            className="self-start font-semibold text-[var(--site-link)] underline-offset-4 hover:underline"
          >
            Conheça a equipe
          </Link>
        </div>
      </section>
    );
  return (
    <section className={`${LARGURA} py-24 @2xl:py-28`}>
      <div className="site-revelar mx-auto flex max-w-3xl flex-col gap-5 text-center">
        {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
        {bloco.texto && (
          <p className="text-[19px] whitespace-pre-line text-[var(--site-tinta-media)]">
            {bloco.texto}
          </p>
        )}
        <Link
          href={`${base}/equipe`}
          className="font-semibold text-[var(--site-link)] underline-offset-4 hover:underline"
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
    <section className="bg-[var(--site-cartao)]">
      <div className={`${LARGURA} flex flex-col gap-11 py-24 @2xl:py-28`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Titulo2>{bloco.titulo || 'Serviços'}</Titulo2>
          <Link
            href={`${base}/servicos`}
            className="font-semibold text-[var(--site-link)] underline-offset-4 hover:underline"
          >
            Ver todos os serviços
          </Link>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-6">
          {lista.map((s) => (
            <li
              key={s.id}
              className="site-revelar site-cartao flex flex-col gap-3 border-t-2 border-[var(--site-escuro)] bg-[var(--site-cartao)] px-1 pt-6 pb-2"
            >
              <h3 className={`${TITULO} text-[30px] leading-tight`}>{s.nome}</h3>
              <p className="text-[var(--site-tinta-suave)]">{duracao(s.duracaoMin)}</p>
              <p className={`${TITULO} text-[36px] leading-none`}>{formatarMoeda(s.preco)}</p>
              {temAgendamento(dados) && (
                <Link
                  href={linkAgendar(dados)}
                  className="mt-1 font-semibold text-[var(--site-link)] underline-offset-4 hover:underline"
                >
                  Agendar {s.nome.toLowerCase()}
                </Link>
              )}
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
    <section className={`${VERDE} text-[var(--site-claro)]`}>
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
            <li key={p.id} className="site-revelar flex items-center gap-5">
              {dados.site.equipe[p.id]?.foto ? (
                <Foto
                  id={dados.site.equipe[p.id]!.foto!}
                  dados={dados}
                  alt={`Foto de ${p.nome}`}
                  tamanhos="96px"
                  className="site-foto-cor size-24 shrink-0 rounded-full border-2 border-[var(--site-destaque)] object-cover"
                />
              ) : (
                <Monograma nome={p.nome} className="size-24 border-2 text-[44px]" />
              )}
              <div className="min-w-0">
                <h3 className={`${TITULO} text-[30px] leading-tight`}>{p.nome}</h3>
                {p.foco && <p className="text-[var(--site-claro-suave)]">{p.foco}</p>}
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
    <section className="bg-[var(--site-cartao)]">
      <div className={`${LARGURA} flex flex-col gap-11 py-24 @2xl:py-28`}>
        {bloco.titulo && <Titulo2>{bloco.titulo}</Titulo2>}
        <ul className="grid grid-cols-2 gap-2 @3xl:grid-cols-3">
          {itens.map((f, i) => (
            <li key={`${f.foto}-${i}`}>
              <figure className="site-revelar relative overflow-hidden">
                <Foto
                  id={f.foto!}
                  dados={dados}
                  alt={f.titulo || `Trabalho da ${dados.barbearia}`}
                  tamanhos="(min-width: 768px) 33vw, 50vw"
                  className="site-foto-zoom aspect-square w-full object-cover"
                />
                {f.titulo && (
                  <figcaption className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] bg-[var(--site-escuro)] px-2.5 py-1 text-[14px] text-white">
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

/** Lote 7h: os planos do clube cadastrados no sistema, com o link de assinatura. */
function PlanosDoClube({ dados }: { dados: SitePublico }) {
  if (!dados.clube)
    return (
      <section className={`${LARGURA} py-16 text-[var(--site-tinta-suave)]`}>
        Os planos do clube aparecem aqui quando estiverem cadastrados e o clube online estiver
        ligado.
      </section>
    );
  return (
    <section className={`${LARGURA} py-20`}>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-6">
        {dados.clube.planos.map((p) => (
          <li
            key={p.id}
            className="site-revelar site-cartao flex flex-col gap-4 border-t-[3px] border-[var(--site-destaque)] bg-[var(--site-cartao)] p-8"
          >
            <h2 className={`${TITULO} text-[30px] leading-tight`}>{p.nome}</h2>
            <p className={`${TITULO} text-[40px] leading-none`}>
              {formatarMoeda(p.valor)}
              <span className="font-[family-name:var(--site-fonte-texto)] text-[16px] text-[var(--site-tinta-suave)]">
                {' '}
                por mês
              </span>
            </p>
            {p.descricao && <p className="text-[var(--site-tinta-media)]">{p.descricao}</p>}
            {p.inclui.length > 0 && (
              <ul className="flex flex-col gap-1 text-[15px] text-[var(--site-tinta-media)]">
                {p.inclui.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            <a
              href={`${dados.clube!.link}&p=${encodeURIComponent(p.id)}`}
              className={`${BOTAO} mt-auto self-start bg-[var(--site-escuro)] text-[var(--site-claro)] focus-visible:outline-[var(--site-escuro)]`}
            >
              Assinar {p.nome}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Botões próprios do dono com link (lote 7m): cardápio, loja, Instagram... */
function BotoesComLink({ bloco }: { bloco: BlocoSite }) {
  const itens = (bloco.itens ?? []).filter((i) => i.titulo && urlDeLinkValida(i.texto));
  if (!itens.length) return null;
  return (
    <section
      className={`${LARGURA} site-revelar flex flex-col items-center gap-6 py-16 text-center`}
    >
      {bloco.titulo && <Titulo2 className="text-[34px] @2xl:text-[44px]">{bloco.titulo}</Titulo2>}
      <div className="flex flex-wrap justify-center gap-3">
        {itens.map((i, n) => (
          <a
            key={`${i.texto}-${n}`}
            href={i.texto}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BOTAO} ${n === 0 ? 'bg-[var(--site-escuro)] text-[var(--site-claro)]' : 'border border-[var(--site-escuro)] text-[var(--site-escuro)]'} focus-visible:outline-[var(--site-escuro)]`}
          >
            {i.titulo}
            <span className="sr-only"> (abre em outra aba)</span>
          </a>
        ))}
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
            className="site-revelar site-cartao flex flex-col gap-4 border-t-[3px] border-[var(--site-destaque)] bg-[var(--site-cartao)] p-8"
          >
            <blockquote className={`${TITULO} text-[23px] leading-snug whitespace-pre-line`}>
              “{d.texto}”
            </blockquote>
            {d.titulo && (
              <figcaption className="text-[15px] text-[var(--site-tinta-suave)]">
                {d.titulo}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function CabecalhoPagina({ bloco }: { bloco: BlocoSite }) {
  return (
    <section className="bg-[var(--site-escuro2)] text-[var(--site-claro)]">
      <div className={`${LARGURA} site-entrada flex flex-col gap-4 pt-20 pb-14`}>
        <h1 className={`${TITULO} text-[44px] leading-none @2xl:text-[72px]`}>{bloco.titulo}</h1>
        {bloco.texto && (
          <p className="max-w-[36em] text-[19px] whitespace-pre-line text-[var(--site-claro-suave)]">
            {bloco.texto}
          </p>
        )}
      </div>
    </section>
  );
}

function TabelaServicos({ dados }: { dados: SitePublico }) {
  const grupos = servicosPorCategoria(dados.servicos);
  if (!grupos.length)
    return (
      <section className={`${LARGURA} py-20 text-[var(--site-tinta-suave)]`}>
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
              className="inline-flex min-h-11 items-center rounded-[var(--site-raio)] border border-[var(--site-linha)] px-4 hover:border-[var(--site-escuro)]"
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
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[var(--site-linha)] py-5"
              >
                <div className="min-w-0">
                  <h3 className="text-[20px] font-semibold">{s.nome}</h3>
                  <p className="text-[15px] text-[var(--site-tinta-suave)]">
                    {duracao(s.duracaoMin)}
                  </p>
                  {(() => {
                    const com = quemFaz(dados.equipe, s.id);
                    return com.length > 0 && com.length < dados.equipe.length ? (
                      <p className="text-[14px] text-[var(--site-tinta-suave)]">
                        Com {com.map((p) => p.nome).join(' e ')}
                      </p>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-5">
                  <span className={`${TITULO} text-[30px] leading-none`}>
                    {formatarMoeda(s.preco)}
                  </span>
                  {temAgendamento(dados) && (
                    <Link
                      href={linkAgendar(dados)}
                      aria-label={`Agendar ${s.nome}`}
                      className={`${BOTAO} border border-[var(--site-link)] px-4 py-2 text-[var(--site-link)] focus-visible:outline-[var(--site-link)]`}
                    >
                      Agendar
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Barbeiros({ dados }: { dados: SitePublico }) {
  if (!dados.equipe.length) return null;
  return (
    <div className={`${LARGURA} flex flex-col gap-20 py-20 @2xl:gap-24 @2xl:py-24`}>
      {dados.equipe.map((p, i) => (
        <article
          key={p.id}
          className={`site-revelar flex flex-col gap-10 @3xl:items-center ${i % 2 ? '@3xl:flex-row-reverse' : '@3xl:flex-row'}`}
        >
          {dados.site.equipe[p.id]?.foto ? (
            <Foto
              id={dados.site.equipe[p.id]!.foto!}
              dados={dados}
              alt={`Foto de ${p.nome}`}
              tamanhos="(min-width: 768px) 360px, 100vw"
              className="site-foto-cor aspect-[4/5] w-full max-w-[360px] object-cover @3xl:flex-1"
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
              {p.foco && <p className="mt-2 text-[19px] text-[var(--site-realce)]">{p.foco}</p>}
            </div>
            {p.sobre && (
              <p className="max-w-[32em] whitespace-pre-line text-[var(--site-tinta-media)]">
                {p.sobre}
              </p>
            )}
            {p.servicoIds.length > 0 && (
              <p className="text-[15px] text-[var(--site-tinta-suave)]">
                Faz:{' '}
                {dados.servicos
                  .filter((sv) => p.servicoIds.includes(sv.id))
                  .map((sv) => sv.nome)
                  .join(', ')}
              </p>
            )}
            {temAgendamento(dados) && (
              <Link
                href={linkAgendar(dados)}
                className={`${BOTAO} self-start bg-[var(--site-escuro)] text-[var(--site-claro)] focus-visible:outline-[var(--site-escuro)]`}
              >
                Agendar com {p.nome}
              </Link>
            )}
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
              className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--site-link)] underline-offset-4 hover:underline"
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
                <tr key={h.dias} className="border-b border-[var(--site-linha)] last:border-0">
                  <th scope="row" className="py-2.5 pr-6 text-left font-normal">
                    {h.dias}
                  </th>
                  <td
                    className={`py-2.5 text-right ${h.horario ? '' : 'text-[var(--site-tinta-suave)]'}`}
                  >
                    {h.horario ?? 'Fechado'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-col gap-4 self-start bg-[var(--site-cartao)] p-8">
        <h2 className={`${TITULO} text-[32px]`}>Fale com a gente</h2>
        {dados.whatsapp && (
          <a
            href={dados.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-3 font-medium text-[var(--site-link)] underline-offset-4 hover:underline"
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
            className="inline-flex min-h-11 items-center gap-3 font-medium text-[var(--site-link)] underline-offset-4 hover:underline"
          >
            <IconeInstagram className="size-5" />
            Instagram @{dados.site.instagram}
          </a>
        )}
        {!dados.whatsapp && !dados.site.instagram && (
          <p className="text-[var(--site-tinta-suave)]">
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
    <section className="bg-[var(--site-cartao)]">
      <div className="mx-auto flex max-w-3xl flex-col px-4 py-20 @2xl:px-6">
        {bloco.titulo && (
          <Titulo2 className="mb-6 text-[36px] @2xl:text-[44px]">{bloco.titulo}</Titulo2>
        )}
        {itens.map((q, i) => (
          <details key={i} className="group border-b border-[var(--site-linha)] py-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[19px] font-semibold [&::-webkit-details-marker]:hidden">
              {q.titulo}
              <span
                aria-hidden
                className="text-[24px] leading-none text-[var(--site-tinta-suave)] transition-transform duration-[var(--ritmo)] group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-line text-[var(--site-tinta-media)]">{q.texto}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FaixaAgendar({ bloco, dados }: { bloco: BlocoSite; dados: SitePublico }) {
  if (!temAgendamento(dados) && !dados.whatsapp) return null;
  return (
    <section className="bg-[var(--site-destaque)] text-[var(--site-escuro)]">
      <div
        className={`${LARGURA} site-revelar flex flex-wrap items-center justify-between gap-6 py-16`}
      >
        <div className="max-w-2xl">
          <p className={`${TITULO} text-[34px] leading-tight @2xl:text-[42px]`}>
            {bloco.titulo || 'Marque seu horário'}
          </p>
          {bloco.texto && <p className="mt-1.5 whitespace-pre-line">{bloco.texto}</p>}
        </div>
        <AcaoPrincipal
          dados={dados}
          className={`${BOTAO} bg-[var(--site-escuro)] text-[18px] text-[var(--site-claro)] focus-visible:outline-[var(--site-escuro)]`}
        />
      </div>
    </section>
  );
}

function Rodape({ dados, base }: { dados: SitePublico; base: string }) {
  const link = 'text-[var(--site-claro-suave)] underline-offset-4 hover:text-white hover:underline';
  const r = rodapeDoSite(dados.site);
  const redes = [
    dados.site.instagram
      ? { nome: 'Instagram', url: `https://instagram.com/${dados.site.instagram}` }
      : null,
    r.facebook ? { nome: 'Facebook', url: r.facebook } : null,
    r.tiktok ? { nome: 'TikTok', url: r.tiktok } : null,
    r.youtube ? { nome: 'YouTube', url: r.youtube } : null,
  ].filter((x): x is { nome: string; url: string } => x !== null);
  const temContato = r.contato && (dados.whatsapp || redes.length > 0);
  return (
    <footer className="bg-[var(--site-rodape)] text-[var(--site-claro-suave)]">
      <div
        className={`${LARGURA} grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-10 pt-16 pb-10`}
      >
        <div className="flex flex-col gap-2">
          <span className={`${TITULO} text-[24px] text-[var(--site-claro)]`}>
            {dados.barbearia}
          </span>
          {dados.site.slogan && <span>{dados.site.slogan}</span>}
          {r.texto && <span className="text-[14px] whitespace-pre-line">{r.texto}</span>}
        </div>
        {r.endereco && dados.endereco && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[var(--site-claro)]">Endereço</strong>
            <span>{dados.endereco}</span>
            <Link
              href={`${base}/contato`}
              className="text-[var(--site-destaque)] underline-offset-4 hover:underline"
            >
              Como chegar
            </Link>
          </div>
        )}
        {r.horario && dados.horario.some((h) => h.horario) && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[var(--site-claro)]">Horário</strong>
            {dados.horario
              .filter((h) => h.horario)
              .map((h) => (
                <span key={h.dias}>
                  {h.dias}, {h.horario}
                </span>
              ))}
          </div>
        )}
        {temContato && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[var(--site-claro)]">Fale com a gente</strong>
            {dados.whatsapp && (
              <a href={dados.whatsapp} target="_blank" rel="noopener noreferrer" className={link}>
                WhatsApp
              </a>
            )}
            {redes.map((rede) => (
              <a
                key={rede.nome}
                href={rede.url}
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                {rede.nome}
              </a>
            ))}
          </div>
        )}
        {r.links.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <strong className="text-[var(--site-claro)]">Links</strong>
            {r.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                {l.rotulo}
              </a>
            ))}
          </div>
        )}
      </div>
      <div
        className={`${LARGURA} flex flex-wrap justify-between gap-3 border-t border-[var(--site-rodape-linha)] pt-5 pb-8 text-[14px] text-[var(--site-rodape-suave)]`}
      >
        <span>{dados.barbearia}</span>
        {r.creditos && (
          <Link href="/" className="hover:text-white">
            Site e agenda pelo Pente Fino
          </Link>
        )}
      </div>
    </footer>
  );
}

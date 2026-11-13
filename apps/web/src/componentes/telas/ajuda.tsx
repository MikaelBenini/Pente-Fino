'use client';

// Central de ajuda (Etapa 23): busca, artigos passo a passo por categoria (cada papel vê os
// dele), perguntas frequentes e contato. O conteúdo vem de packages/shared/src/ajuda.ts.
import {
  artigosPara,
  buscarAjuda,
  CATEGORIAS_AJUDA,
  PERGUNTAS_AJUDA,
  type ArtigoAjuda,
} from '@pente-fino/shared';
import { linkWhatsappSuporte } from '@/lib/contato';
import { Campo } from '@pente-fino/ui';
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, Mail, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { EMAIL_CONTATO } from '@/lib/site';
import { useApp } from '../contexto-app';
import { CabecalhoPagina } from '../pagina';
import { ChatAjuda } from './chat-ajuda';

const classeLink =
  'font-semibold text-tinta underline underline-offset-4 hover:decoration-modulo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco';

export function TelaAjuda() {
  const { papeis } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const artigos = artigosPara(papeis);
  const aberto = artigos.find((a) => a.id === params.get('artigo'));
  const abrir = (id: string | null) =>
    router.push(id ? `/ajuda?artigo=${id}` : '/ajuda', { scroll: true });

  if (aberto) return <Artigo artigo={aberto} onVoltar={() => abrir(null)} />;

  const achados = busca.trim() ? buscarAjuda(busca, papeis) : null;
  const perguntas = PERGUNTAS_AJUDA.filter(
    (p) => !p.artigo || artigos.some((a) => a.id === p.artigo),
  );
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina titulo="Ajuda" pergunta="Como fazer cada coisa no Pente Fino" />
      <div className="max-w-xl">
        <Campo
          id="ajuda-busca"
          rotulo="O que você quer fazer?"
          placeholder="Ex.: conectar WhatsApp, fechar caixa, comissão"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {achados ? (
        <section aria-labelledby="titulo-resultados" className="flex flex-col gap-3">
          <h2 id="titulo-resultados" className="text-lg font-semibold">
            {achados.length
              ? `${achados.length} ${achados.length === 1 ? 'artigo' : 'artigos'}`
              : 'Nada encontrado'}
          </h2>
          {achados.length === 0 && (
            <p className="text-tinta-suave">
              Tente outras palavras, veja as perguntas frequentes abaixo ou fale com a gente.
            </p>
          )}
          <ListaArtigos artigos={achados} />
        </section>
      ) : (
        CATEGORIAS_AJUDA.map((c) => {
          const daCategoria = artigos.filter((a) => a.categoria === c);
          if (daCategoria.length === 0) return null;
          const id = `ajuda-${c
            .normalize('NFD')
            .replace(/[^\w]+/g, '-')
            .toLowerCase()}`;
          return (
            <section key={c} aria-labelledby={id} className="flex flex-col gap-3">
              <h2 id={id} className="text-lg font-semibold">
                {c}
              </h2>
              <ListaArtigos artigos={daCategoria} />
            </section>
          );
        })
      )}

      <section aria-labelledby="titulo-perguntas" className="flex flex-col gap-3">
        <h2 id="titulo-perguntas" className="text-lg font-semibold">
          Perguntas frequentes
        </h2>
        <div className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
          {perguntas.map((p) => (
            <details key={p.pergunta} className="group px-4">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-3 font-semibold">
                {p.pergunta}
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="pb-4 text-tinta-suave">
                {p.resposta}{' '}
                {p.artigo && (
                  <Link href={`/ajuda?artigo=${p.artigo}`} className={classeLink}>
                    Ver o passo a passo
                  </Link>
                )}
              </p>
            </details>
          ))}
        </div>
      </section>

      <Contato />
    </div>
  );
}

function ListaArtigos({ artigos }: { artigos: readonly ArtigoAjuda[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {artigos.map((a) => (
        <li key={a.id}>
          <Link
            href={`/ajuda?artigo=${a.id}`}
            className="flex h-full flex-col gap-1 rounded-lg border border-borda bg-superficie p-4 hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            <span className="flex items-start gap-2 font-semibold">
              <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-modulo-texto" />
              {a.titulo}
            </span>
            <span className="text-sm text-tinta-suave">{a.resumo}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Artigo({ artigo, onVoltar }: { artigo: ArtigoAjuda; onVoltar: () => void }) {
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <button
        type="button"
        onClick={onVoltar}
        className="flex min-h-11 items-center gap-2 self-start font-semibold text-tinta-suave hover:text-tinta"
      >
        <ArrowLeft aria-hidden className="size-4" /> Ajuda
      </button>
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
          {artigo.categoria}
        </p>
        <h1 className="text-3xl font-semibold">{artigo.titulo}</h1>
        <p className="text-lg text-tinta-suave">{artigo.resumo}</p>
      </header>
      <ol className="flex flex-col gap-3">
        {artigo.passos.map((p, i) => (
          <li key={p} className="flex gap-3 rounded-lg border border-borda bg-superficie p-4">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-modulo font-denso font-bold text-[#121211]"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{p}</span>
          </li>
        ))}
      </ol>
      {artigo.dica && (
        <p className="flex gap-2 rounded-lg border border-borda-forte p-4 text-tinta-suave">
          <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-modulo-texto" />
          {artigo.dica}
        </p>
      )}
      {artigo.rota && (
        <Link
          href={artigo.rota}
          className="flex min-h-11 items-center gap-2 self-start rounded-md bg-acao px-4 font-semibold text-sobre-acao hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Ir para a tela <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
      <Contato />
    </article>
  );
}

function Contato() {
  // Painel M10: WhatsApp e horário do suporte quando o dono cadastrar (lib/contato.ts).
  const whatsapp = linkWhatsappSuporte();
  return (
    <section
      id="contato"
      aria-labelledby="titulo-contato"
      className="flex scroll-mt-24 flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
    >
      <h2 id="titulo-contato" className="font-semibold">
        Falar com o suporte
      </h2>
      {/* Admin F6: o chat com a equipe, ligado à conta (o e-mail fica como alternativa). */}
      <ChatAjuda />
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={`${classeLink} flex items-center gap-2`}
        >
          <MessageCircle aria-hidden className="size-4" /> WhatsApp do suporte
        </a>
      )}
      <a href={`mailto:${EMAIL_CONTATO}`} className={`${classeLink} flex items-center gap-2`}>
        <Mail aria-hidden className="size-4" /> {EMAIL_CONTATO}
      </a>
    </section>
  );
}

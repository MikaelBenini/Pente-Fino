// Site N4: lista do blog e página do post, com Article JSON-LD, data, tempo de leitura,
// chamada no meio e no fim e páginas relacionadas.
import { trilhaJsonLd } from '@pente-fino/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { minutosDeLeitura, POSTS_PUBLICADOS, type PostBlog } from '@/conteudo/blog';
import { URL_SITE } from '@/lib/site';
import { BotaoTesteOferta, LinkCadastro } from './oferta-lancamento';

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

const JsonLd = ({ dados }: { dados: object }) => (
  <script
    type="application/ld+json"
    // Sem dado de usuário; "<" escapado para não fechar o <script>.
    dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }}
  />
);

function Data({ post }: { post: PostBlog & { publicadoEm: string } }) {
  return (
    <p className="text-sm text-tinta-suave">
      <time dateTime={post.publicadoEm}>{dataBr(post.publicadoEm)}</time> · {minutosDeLeitura(post)}{' '}
      min de leitura
    </p>
  );
}

export function metadadosPost(p: PostBlog & { publicadoEm: string }): Metadata {
  const caminho = `/blog/${p.slug}`;
  return {
    title: p.titulo,
    description: p.descricao,
    alternates: { canonical: caminho },
    openGraph: {
      type: 'article',
      title: p.titulo,
      description: p.descricao,
      url: caminho,
      publishedTime: p.publicadoEm,
    },
  };
}

export function ListaDoBlog() {
  return (
    <>
      <JsonLd
        dados={trilhaJsonLd([
          { nome: 'Pente Fino', url: `${URL_SITE}/` },
          { nome: 'Blog', url: `${URL_SITE}/blog` },
        ])}
      />
      <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
          Blog
        </p>
        <h1 className="font-denso text-4xl leading-[0.95] font-bold uppercase sm:text-6xl">
          Gestão de barbearia, com números de verdade
        </h1>
        <p className="max-w-3xl text-lg text-tinta-suave">
          Lucro, comissão, preço e agenda, explicados com as contas de uma barbearia de verdade.
        </p>
      </section>
      <ul className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 sm:px-6">
        {POSTS_PUBLICADOS.map((p) => (
          <li key={p.slug} className="rounded-2xl border border-borda bg-superficie p-5 sm:p-6">
            <article className="flex flex-col gap-2">
              <h2 className="font-denso text-2xl font-bold uppercase">
                <Link href={`/blog/${p.slug}`} className="hover:underline">
                  {p.titulo}
                </Link>
              </h2>
              <Data post={p} />
              <p className="text-tinta-suave">{p.descricao}</p>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PaginaPost({ post: p }: { post: PostBlog & { publicadoEm: string } }) {
  const url = `${URL_SITE}/blog/${p.slug}`;
  const outros = POSTS_PUBLICADOS.filter((x) => x.slug !== p.slug).slice(0, 3);
  return (
    <>
      <JsonLd
        dados={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: p.titulo,
          description: p.descricao,
          datePublished: p.publicadoEm,
          dateModified: p.publicadoEm,
          mainEntityOfPage: url,
          author: { '@type': 'Organization', name: 'Pente Fino', url: URL_SITE },
          publisher: {
            '@type': 'Organization',
            name: 'Pente Fino',
            logo: { '@type': 'ImageObject', url: `${URL_SITE}/icones/icone-512.png` },
          },
        }}
      />
      <JsonLd
        dados={trilhaJsonLd([
          { nome: 'Pente Fino', url: `${URL_SITE}/` },
          { nome: 'Blog', url: `${URL_SITE}/blog` },
          { nome: p.titulo, url },
        ])}
      />
      <article className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-14 pb-12 sm:px-6 sm:pt-20">
        <Link href="/blog" className="text-sm text-tinta-suave underline underline-offset-4">
          Blog
        </Link>
        <h1 className="font-denso text-4xl leading-[0.95] font-bold uppercase sm:text-5xl">
          {p.titulo}
        </h1>
        <Data post={p} />
        <div className="flex flex-col gap-5 text-lg leading-relaxed">
          {p.blocos.map((b, i) => {
            if (b.tipo === 'h2')
              return (
                <h2 key={i} className="mt-4 font-denso text-3xl font-bold uppercase">
                  {b.texto}
                </h2>
              );
            if (b.tipo === 'lista')
              return (
                <ul key={i} className="flex list-disc flex-col gap-2 pl-5 text-tinta-suave">
                  {b.itens.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              );
            if (b.tipo === 'chamada')
              return (
                <aside
                  key={i}
                  aria-label="Teste grátis"
                  className="flex flex-col gap-3 rounded-2xl border border-modulo/40 bg-superficie p-5"
                >
                  <p className="font-semibold">
                    O Pente Fino faz essa conta sozinho, em cada comanda.
                  </p>
                  <BotaoTesteOferta extra="origem=blog" className="self-start" />
                </aside>
              );
            return (
              <p key={i} className="text-tinta-suave">
                {b.texto}
              </p>
            );
          })}
        </div>
      </article>
      {p.relacionados.length > 0 && (
        <nav aria-label="Leia também" className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
          <h2 className="mb-3 font-semibold">Leia também</h2>
          <ul className="flex flex-col gap-1">
            {[
              ...outros.map((o) => ({ href: `/blog/${o.slug}`, rotulo: o.titulo })),
              ...p.relacionados,
            ].map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="inline-flex min-h-9 items-center text-tinta underline underline-offset-4"
                >
                  {r.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pb-16 text-center sm:px-6">
        <h2 className="font-denso text-4xl font-bold uppercase">Saiba quanto sobra</h2>
        <LinkCadastro grande>Criar conta grátis</LinkCadastro>
      </section>
    </>
  );
}

import type { ReactNode } from 'react';
import { VERSAO_TERMOS } from '@/lib/site';

const dataVersao = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: 'America/Sao_Paulo',
}).format(new Date(`${VERSAO_TERMOS}T12:00:00Z`));

export interface SecaoLegal {
  id: string;
  titulo: string;
  conteudo: ReactNode;
}

/** Texto longo para ler: coluna estreita, índice no topo e âncoras por seção. */
export function DocumentoLegal({
  titulo,
  resumo,
  secoes,
}: {
  titulo: string;
  resumo: string;
  secoes: readonly SecaoLegal[];
}) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-14 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-denso text-5xl font-bold uppercase">{titulo}</h1>
        <p className="text-sm text-tinta-suave">
          Versão de <time dateTime={VERSAO_TERMOS}>{dataVersao}</time>
        </p>
        <p className="text-lg text-tinta-suave">{resumo}</p>
      </header>
      <nav aria-label="Seções" className="rounded-xl border border-borda bg-superficie p-5">
        <ol className="grid list-decimal gap-1 pl-5 text-tinta-suave sm:grid-cols-2">
          {secoes.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-tinta hover:underline">
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {secoes.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-t`}
          className="flex scroll-mt-20 flex-col gap-3 leading-relaxed text-tinta-suave [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-tinta"
        >
          <h2 id={`${s.id}-t`} className="text-2xl font-semibold text-tinta">
            {i + 1}. {s.titulo}
          </h2>
          {s.conteudo}
        </section>
      ))}
    </article>
  );
}

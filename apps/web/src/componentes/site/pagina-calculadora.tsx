// Site N3: página de uma calculadora grátis, com a explicação da conta, um exemplo e a chamada.
import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkCadastro } from './oferta-lancamento';
import { TrilhaGoogle } from './trilha-google';

export const CALCULADORAS = [
  { caminho: '/calculadora/lucro-por-corte', nome: 'Lucro por corte' },
  { caminho: '/calculadora/comissao-de-barbeiro', nome: 'Comissão de barbeiro' },
  { caminho: '/calculadora/preco-do-corte', nome: 'Preço do corte' },
] as const;

export function metadadosCalculadora(titulo: string, descricao: string, caminho: string): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: { title: titulo, description: descricao, url: caminho },
  };
}

export function PaginaCalculadora({
  caminho,
  nome,
  h1,
  intro,
  formula,
  exemplo,
  children,
}: {
  caminho: (typeof CALCULADORAS)[number]['caminho'];
  nome: string;
  h1: string;
  intro: string;
  /** Linhas da conta, em palavras. */
  formula: readonly string[];
  exemplo: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <TrilhaGoogle pagina={`Calculadora: ${nome}`} caminho={caminho} />
      <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
          Calculadora grátis
        </p>
        <h1 className="font-denso text-4xl leading-[0.95] font-bold uppercase sm:text-6xl">{h1}</h1>
        <p className="max-w-3xl text-lg text-tinta-suave">{intro}</p>
      </section>
      <section aria-label={`Calculadora: ${nome}`} className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        {children}
      </section>
      <section
        aria-labelledby="como-calcula"
        className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-14 sm:px-6"
      >
        <h2 id="como-calcula" className="font-denso text-3xl font-bold uppercase">
          Como a conta é feita
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-tinta-suave">
          {formula.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <h3 className="mt-4 font-semibold">Exemplo</h3>
        <p className="text-tinta-suave">{exemplo}</p>
      </section>
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pb-16 text-center sm:px-6">
        <h2 className="font-denso text-4xl font-bold uppercase">Pare de fazer conta na mão</h2>
        <p className="text-tinta-suave">
          O Pente Fino faz essa conta em cada comanda, com os números reais da sua barbearia.
        </p>
        <LinkCadastro grande>Criar conta grátis</LinkCadastro>
      </section>
      <nav
        aria-label="Outras calculadoras"
        className="mx-auto max-w-6xl border-t border-borda px-4 py-10 sm:px-6"
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {CALCULADORAS.filter((c) => c.caminho !== caminho).map((c) => (
            <li key={c.caminho}>
              <Link
                href={c.caminho}
                className="inline-flex min-h-9 items-center text-tinta underline underline-offset-4"
              >
                Calculadora: {c.nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

// Site N1: página por termo de busca. H1 com o termo, resposta direta, seções com as telas do
// sistema, quanto custa (da tabela de preços), perguntas com JSON-LD e chamada para o cadastro.
import { DIAS_TESTE, formatarMoeda, precoPorMes } from '@pente-fino/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PAGINAS_BUSCA, type PaginaBusca } from '@/conteudo/paginas-busca';
import { LinkCadastro } from './oferta-lancamento';
import { Perguntas } from './perguntas';
import { SeloPlano } from './selo-plano';
import { TrilhaGoogle } from './trilha-google';
import { Celular, Janela, TELAS } from './vitrine';

export function metadadosBusca(p: PaginaBusca): Metadata {
  return {
    title: p.titulo,
    description: p.descricao,
    alternates: { canonical: p.caminho },
    openGraph: { title: p.titulo, description: p.descricao, url: p.caminho },
  };
}

function perguntasJsonLd(p: PaginaBusca) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.perguntas.map((q) => ({
      '@type': 'Question',
      name: q.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: q.resposta },
    })),
  };
}

export function PaginaDeBusca({ pagina: p }: { pagina: PaginaBusca }) {
  const aPartirDe = formatarMoeda(precoPorMes('basico', 'anual'));
  const outras = PAGINAS_BUSCA.filter((x) => x.caminho !== p.caminho);
  return (
    <>
      <script
        type="application/ld+json"
        // Sem dado de usuário; "<" escapado para não fechar o <script>.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(perguntasJsonLd(p)).replace(/</g, '\\u003c'),
        }}
      />
      <TrilhaGoogle pagina={p.nome} caminho={p.caminho} />

      <section className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-14 pb-12 sm:px-6 sm:pt-20">
        <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
          {p.nome}
        </p>
        <h1 className="font-denso text-4xl leading-[0.95] font-bold uppercase sm:text-6xl">
          {p.h1}
        </h1>
        <p className="max-w-3xl text-lg text-tinta-suave">{p.resposta}</p>
        <div className="flex flex-wrap items-center gap-4">
          <LinkCadastro grande>Testar {DIAS_TESTE} dias grátis</LinkCadastro>
          <Link href="/planos" className="text-tinta underline underline-offset-4">
            Ver planos e preços
          </Link>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-16 sm:px-6">
        {p.secoes.map((s, i) => {
          const tela = s.tela ? TELAS[s.tela] : null;
          const celular = tela ? tela.w < tela.h : false;
          return (
            <section
              key={s.titulo}
              className={`grid items-center gap-8 ${tela ? 'md:grid-cols-2' : 'max-w-3xl'}`}
            >
              <div className={`flex flex-col gap-3 ${tela && i % 2 ? 'md:order-2' : ''}`}>
                <h2 className="font-denso text-3xl font-bold uppercase">
                  {s.titulo} {s.recurso && <SeloPlano recurso={s.recurso} />}
                </h2>
                <p className="text-lg text-tinta-suave">{s.texto}</p>
              </div>
              {tela &&
                (celular ? (
                  <Celular tela={tela} alt={s.alt ?? ''} className="mx-auto w-56 sm:w-64" />
                ) : (
                  <Janela tela={tela} alt={s.alt ?? ''} />
                ))}
            </section>
          );
        })}
      </div>

      <section
        aria-labelledby="quanto-custa"
        className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-16 sm:px-6"
      >
        <h2 id="quanto-custa" className="font-denso text-4xl font-bold uppercase">
          Quanto custa
        </h2>
        <p className="text-lg text-tinta-suave">
          A partir de {aPartirDe} por mês no plano anual, por barbearia, sem cobrar por cadeira.{' '}
          {DIAS_TESTE} dias grátis, sem cartão e sem fidelidade.
        </p>
        <Link href="/planos" className="self-start text-tinta underline underline-offset-4">
          Comparar os planos
        </Link>
      </section>

      <section
        aria-labelledby="duvidas"
        className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-16 sm:px-6"
      >
        <h2 id="duvidas" className="font-denso text-4xl font-bold uppercase">
          Dúvidas
        </h2>
        <Perguntas itens={p.perguntas} />
      </section>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pb-16 text-center sm:px-6">
        <h2 className="font-denso text-4xl font-bold uppercase">Comece hoje, decida depois</h2>
        <LinkCadastro grande>Criar conta grátis</LinkCadastro>
      </section>

      <nav
        aria-label="Veja também"
        className="mx-auto max-w-6xl border-t border-borda px-4 py-10 sm:px-6"
      >
        <h2 className="mb-3 text-sm font-semibold text-tinta-suave">Veja também</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {outras.map((o) => (
            <li key={o.caminho}>
              <Link
                href={o.caminho}
                className="inline-flex min-h-9 items-center text-tinta underline underline-offset-4"
              >
                {o.nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

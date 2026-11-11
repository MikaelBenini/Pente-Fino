import type { Metadata } from 'next';
import { CabecalhoSite } from '@/componentes/site/cabecalho-site';
import { LinkBotao } from '@/componentes/site/link-botao';
import { RodapeSite } from '@/componentes/site/rodape-site';

// Página 404 de verdade (briefing do site, B1): status 404 e caminho de volta. O Next já marca a
// página não encontrada com "noindex" (fora do Google).
export const metadata: Metadata = { title: 'Página não encontrada' };

export default function NaoEncontrada() {
  return (
    <div className="flex min-h-dvh flex-col">
      <CabecalhoSite />
      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-5 px-4 py-20 sm:px-6"
      >
        <p className="font-denso text-lg font-semibold tracking-widest text-modulo-texto uppercase">
          Erro 404
        </p>
        <h1 className="font-denso text-5xl leading-[0.95] font-bold uppercase sm:text-6xl">
          Página não encontrada
        </h1>
        <p className="text-lg text-tinta-suave">
          O endereço pode ter mudado ou ter sido digitado errado.
        </p>
        <nav aria-label="Para onde ir" className="flex flex-wrap gap-3">
          <LinkBotao href="/">Página inicial</LinkBotao>
          <LinkBotao href="/planos" variante="contorno">
            Planos e preços
          </LinkBotao>
          <LinkBotao href="/cadastro" variante="contorno">
            Testar grátis
          </LinkBotao>
        </nav>
      </main>
      <RodapeSite />
    </div>
  );
}

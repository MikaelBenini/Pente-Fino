import Link from 'next/link';
import { Marca } from '../marca';
import { LinkBotao } from './link-botao';

export function CabecalhoSite() {
  return (
    <header className="cabecalho-rolagem sticky top-0 z-30 border-b border-borda bg-fundo/90 backdrop-blur supports-[backdrop-filter]:bg-fundo/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Pente Fino, página inicial"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foco"
        >
          <Marca compacta />
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/planos"
            className="hidden min-h-11 items-center rounded-md px-3 font-medium text-tinta-suave hover:text-tinta sm:inline-flex"
          >
            Planos
          </Link>
          <Link
            href="/entrar"
            className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-tinta-suave hover:text-tinta"
          >
            Entrar
          </Link>
          <LinkBotao href="/cadastro">Testar grátis</LinkBotao>
        </nav>
      </div>
    </header>
  );
}

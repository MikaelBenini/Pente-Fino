import { CabecalhoSite } from '@/componentes/site/cabecalho-site';
import { RodapeSite } from '@/componentes/site/rodape-site';
import { AvisoCookies, TagGoogle } from '@/componentes/site/tag-google';

export default function LayoutSite({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-modulo focus:px-4 focus:py-2 focus:text-sobre-modulo"
      >
        Pular para o conteúdo
      </a>
      <CabecalhoSite />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <RodapeSite />
      <TagGoogle />
      <AvisoCookies />
    </div>
  );
}

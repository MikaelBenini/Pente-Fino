import { CabecalhoSite } from '@/componentes/site/cabecalho-site';
import { FaixaOferta } from '@/componentes/site/oferta-lancamento';
import { RodapeSite } from '@/componentes/site/rodape-site';
import { AvisoCookies, TagGoogle } from '@/componentes/site/tag-google';
import { ChatSite } from '@/componentes/site/chat-site';
import { MedicaoVisita } from '@/componentes/site/medicao-visita';

export default function LayoutSite({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-modulo focus:px-4 focus:py-2 focus:text-sobre-modulo"
      >
        Pular para o conteúdo
      </a>
      <FaixaOferta />
      <CabecalhoSite />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <RodapeSite />
      {/* Admin F6: chat com a equipe no lugar do botão do WhatsApp. */}
      <ChatSite />
      <TagGoogle />
      <MedicaoVisita />
      <AvisoCookies />
    </div>
  );
}

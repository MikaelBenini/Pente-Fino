import { ComandaExemplo } from '@/componentes/comanda-exemplo';
import Link from 'next/link';
import { Marca } from '@/componentes/marca';

export default function LayoutPublico({ children }: LayoutProps<'/'>) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <aside className="hidden flex-col justify-between gap-12 border-r border-borda bg-[linear-gradient(160deg,var(--superficie-2),var(--fundo)_55%)] px-[max(3rem,env(safe-area-inset-left))] py-12 lg:flex">
        <Link href="/" aria-label="Pente Fino, página inicial" className="self-start">
          <Marca />
        </Link>
        <div className="flex flex-col items-start gap-10">
          <h1 className="max-w-[16ch] font-denso text-6xl font-bold uppercase leading-[0.95] text-tinta">
            Saiba quanto sobra, <span className="text-modulo-texto">não só quanto entrou.</span>
          </h1>
          <ComandaExemplo />
        </div>
        <p className="text-sm text-tinta-suave">
          Lucro real por serviço, por barbeiro e por unidade.
        </p>
      </aside>
      <main className="flex flex-col px-[max(1rem,env(safe-area-inset-left))] py-8 pr-[max(1rem,env(safe-area-inset-right))] sm:px-10">
        <Link
          href="/"
          aria-label="Pente Fino, página inicial"
          className="mb-10 self-start lg:hidden"
        >
          <Marca />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}

import { WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import { Marca } from '@/componentes/marca';
import { BotaoRecarregar } from './recarregar';

export const metadata: Metadata = { title: 'Sem internet' };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-[max(1rem,env(safe-area-inset-left))] py-10">
      <Marca />
      <WifiOff aria-hidden className="size-10 text-modulo-texto" strokeWidth={1.5} />
      <h1 className="text-3xl font-semibold">Sem internet</h1>
      <p className="text-tinta-suave">
        Esta tela ainda não foi aberta neste aparelho. Quando o sinal voltar, ela carrega
        normalmente. Lançamentos feitos sem internet ficam guardados aqui e sobem sozinhos.
      </p>
      <BotaoRecarregar />
    </main>
  );
}

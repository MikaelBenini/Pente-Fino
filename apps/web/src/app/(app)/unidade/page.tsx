'use client';

import { Check, Network, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@pente-fino/ui';
import { useApp } from '@/componentes/contexto-app';
import { escolherUnidade, type UnidadeAtiva } from '@/lib/sessao';

export default function EscolherUnidade() {
  const { usuario, unidades, unidadeAtiva } = useApp();
  const router = useRouter();
  const naConta = usuario.papeis.some((p) => p.unidadeId === null);
  const opcoes: { valor: UnidadeAtiva; nome: string; detalhe: string; rede?: boolean }[] = [
    ...(naConta
      ? [
          {
            valor: 'todas',
            nome: 'Todas as unidades',
            detalhe: 'Números da rede somados e comparados',
            rede: true,
          },
        ]
      : []),
    ...unidades.map((u) => ({
      valor: u.id,
      nome: u.nome,
      detalhe: u.ativa ? 'Unidade' : 'Unidade desativada',
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Escolha a unidade</h1>
        <p className="text-tinta-suave">
          O menu e os números passam a mostrar só a unidade escolhida. Dá para trocar a qualquer
          hora.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {opcoes.map((o) => {
          const atual = o.valor === unidadeAtiva;
          const Icone = o.rede ? Network : Store;
          return (
            <li key={o.valor}>
              <button
                type="button"
                aria-pressed={atual}
                onClick={() => {
                  escolherUnidade(o.valor);
                  router.replace('/');
                }}
                className={cn(
                  'flex min-h-16 w-full items-center gap-4 rounded-lg border bg-superficie px-4 text-left transition-colors',
                  'hover:border-borda-forte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                  atual ? 'border-modulo' : 'border-borda',
                )}
              >
                <Icone
                  aria-hidden
                  className="size-6 shrink-0 text-modulo-texto"
                  strokeWidth={1.75}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-semibold">{o.nome}</span>
                  <span className="text-sm text-tinta-suave">{o.detalhe}</span>
                </span>
                {atual && <Check aria-label="Unidade atual" className="size-5 text-modulo-texto" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

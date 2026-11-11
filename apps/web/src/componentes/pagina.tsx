'use client';

import { Botao, Carregando, cn, EstadoVazio } from '@pente-fino/ui';
import { CloudOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErroApi } from '@/lib/api';
import { nomeDaUnidade, useApp } from './contexto-app';

export function CabecalhoPagina({
  titulo,
  pergunta,
  acao,
}: {
  titulo: string;
  pergunta?: string;
  acao?: ReactNode;
}) {
  const contexto = useApp();
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
          {nomeDaUnidade(contexto)}
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{titulo}</h1>
        {pergunta && <p className="text-lg text-tinta-suave">{pergunta}</p>}
      </div>
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
    </header>
  );
}

/** Carregando, erro ou conteúdo de uma consulta. */
export function Estado({
  consulta,
  children,
}: {
  consulta: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  children: () => ReactNode;
}) {
  if (consulta.isPending) return <Carregando />;
  if (consulta.isError) {
    const msg =
      consulta.error instanceof ErroApi ? consulta.error.message : 'Não deu para carregar.';
    return (
      <EstadoVazio
        icone={CloudOff}
        titulo="Não deu para carregar"
        texto={msg}
        acao={
          <Botao variante="secundario" onClick={() => consulta.refetch()}>
            Tentar de novo
          </Botao>
        }
      />
    );
  }
  return <>{children()}</>;
}

/** Tabela de dados com rolagem própria (a página nunca rola de lado). */
export function Tabela({
  rotulo,
  children,
  className,
}: {
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  // `relative`: o texto só para leitor de tela (sr-only, absoluto) fica preso aqui dentro; sem
  // isso ele escapa da rolagem e alarga a página no celular (painel A8: /servicos com 748 px).
  return (
    <div
      className={cn(
        'relative overflow-x-auto rounded-lg border border-borda bg-superficie',
        className,
      )}
    >
      <table className="tabela-dados w-full border-collapse text-left">
        <caption className="sr-only">{rotulo}</caption>
        {children}
      </table>
    </div>
  );
}

export const th =
  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-tinta-suave whitespace-nowrap';
export const td = 'px-4 py-3 align-middle';

/** Ficha de situação com texto (nunca só cor). */
export function Ficha({
  tom,
  children,
}: {
  tom: 'acao' | 'aviso' | 'neutro' | 'perigo';
  children: ReactNode;
}) {
  const classe = {
    acao: 'border-acao-texto/60 text-acao-texto',
    aviso: 'border-aviso-texto/60 text-aviso-texto',
    neutro: 'border-borda-forte text-tinta-suave',
    perigo: 'border-perigo-texto/60 text-perigo-texto',
  }[tom];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-2 py-0.5 font-denso text-sm font-semibold uppercase tracking-wide whitespace-nowrap',
        classe,
      )}
    >
      {children}
    </span>
  );
}

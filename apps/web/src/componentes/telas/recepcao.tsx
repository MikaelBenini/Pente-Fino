'use client';

// Modo recepção (seção 7): a tela de Comandas para o monitor do balcão. A fila do dia em letra
// grande: o próximo cliente em destaque e três colunas (chegando, na cadeira e para receber),
// com botões grandes. Atualiza sozinha a cada 30 s; "Tela cheia" esconde o menu.
import {
  chegadaAtrasada,
  dataLocal,
  filaDaRecepcao,
  formatarHora,
  formatarMoeda,
  type ComandaResumo,
} from '@pente-fino/shared';
import { Botao, cn } from '@pente-fino/ui';
import { ArrowLeft, Expand, Shrink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { chavesOperacao, INVALIDAR_OPERACAO, useAcao, useComandas } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { Estado } from '../pagina';
import { useUnidadeTrabalho } from '../unidade-trabalho';

/** O relógio da tela: muda a cada 15 s (o minuto nunca fica atrasado mais que isso). */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

/** Tela cheia do navegador, para o monitor do balcão. */
function useTelaCheia() {
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const aoMudar = () => setCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', aoMudar);
    return () => document.removeEventListener('fullscreenchange', aoMudar);
  }, []);
  const alternar = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return { cheia, alternar };
}

export function ModoRecepcao() {
  const { unidades } = useApp();
  const { unidadeId, seletor } = useUnidadeTrabalho();
  const agora = useAgora();
  const comandas = useComandas(unidadeId, dataLocal(agora));
  const { cheia, alternar } = useTelaCheia();
  const nome = unidades.find((u) => u.id === unidadeId)?.nome;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/comandas"
            className="inline-flex min-h-11 items-center gap-2 font-medium text-tinta-suave hover:text-tinta"
          >
            <ArrowLeft aria-hidden className="size-5" /> Sair do modo recepção
          </Link>
          {seletor}
        </div>
        <div className="flex items-center gap-4">
          <p className="text-tinta-suave">{nome}</p>
          <time
            dateTime={agora.toISOString()}
            className="text-4xl font-semibold tabular-nums"
            aria-label={`Agora, ${formatarHora(agora.toISOString())}`}
          >
            {formatarHora(agora.toISOString())}
          </time>
          <Botao variante="secundario" onClick={alternar}>
            {cheia ? (
              <>
                <Shrink aria-hidden className="size-5" /> Sair da tela cheia
              </>
            ) : (
              <>
                <Expand aria-hidden className="size-5" /> Tela cheia
              </>
            )}
          </Botao>
        </div>
      </header>
      <h1 className="sr-only">Modo recepção</h1>
      <Estado consulta={comandas}>{() => <Fila comandas={comandas.data!} agora={agora} />}</Estado>
    </div>
  );
}

function Fila({ comandas, agora }: { comandas: ComandaResumo[]; agora: Date }) {
  const fila = filaDaRecepcao(comandas, agora);
  const [erro, setErro] = useState<string | null>(null);
  const iniciar = useAcao(
    (id: string) => api(`comandas/${id}/iniciar`, { corpo: {} }),
    [[...chavesOperacao.comandas], ...INVALIDAR_OPERACAO],
  );
  async function comecar(id: string) {
    setErro(null);
    try {
      await iniciar.mutateAsync(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para começar o atendimento.');
    }
  }
  const p = fila.proximo;
  const resto = fila.chegando.slice(1);

  return (
    <div className="flex flex-col gap-6">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <section
        aria-labelledby="recepcao-proximo"
        className="flex flex-wrap items-center justify-between gap-6 rounded-lg border-2 border-modulo bg-superficie p-6"
      >
        <div className="min-w-0">
          <h2 id="recepcao-proximo" className="text-lg text-tinta-suave">
            Próximo
          </h2>
          {p ? (
            <>
              <p className="truncate text-4xl font-semibold sm:text-5xl">
                {p.cliente ?? 'Sem cliente'}
              </p>
              <p className="mt-1 text-xl text-tinta-suave">
                {p.inicio && `${formatarHora(p.inicio)} com `}
                {p.profissional}
                {p.servicos.length > 0 && ` · ${p.servicos.join(', ')}`}
              </p>
              {chegadaAtrasada(p, agora) && (
                <p className="mt-2 text-lg font-semibold text-aviso-texto">
                  Atrasado {Math.round((agora.getTime() - new Date(p.inicio!).getTime()) / 60_000)}{' '}
                  min
                </p>
              )}
            </>
          ) : (
            <p className="text-3xl font-semibold">Ninguém mais marcado hoje</p>
          )}
        </div>
        {p && (
          <button
            type="button"
            onClick={() => comecar(p.id)}
            disabled={iniciar.isPending}
            className="min-h-16 rounded-lg bg-modulo px-8 text-xl font-semibold text-sobre-modulo hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco disabled:opacity-60"
          >
            Chegou: começar atendimento
          </button>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Coluna titulo="Chegando" vazio="Ninguém na fila depois do próximo." n={resto.length}>
          {resto.map((c) => (
            <Cartao key={c.id} c={c} atrasado={chegadaAtrasada(c, agora)}>
              <button
                type="button"
                onClick={() => comecar(c.id)}
                disabled={iniciar.isPending}
                className="min-h-12 rounded-md border border-borda bg-superficie-2 px-4 text-lg font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco disabled:opacity-60"
              >
                Começar
              </button>
            </Cartao>
          ))}
        </Coluna>
        <Coluna titulo="Na cadeira" vazio="Nenhum atendimento agora." n={fila.naCadeira.length}>
          {fila.naCadeira.map((c) => (
            <Cartao key={c.id} c={c} />
          ))}
        </Coluna>
        <Coluna titulo="Para receber" vazio="Nada para receber agora." n={fila.paraReceber.length}>
          {fila.paraReceber.map((c) => (
            <Cartao key={c.id} c={c} valor>
              <Link
                href={`/comandas?id=${c.id}`}
                className="inline-flex min-h-12 items-center rounded-md bg-modulo px-5 text-lg font-semibold text-sobre-modulo hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
              >
                Receber
              </Link>
            </Cartao>
          ))}
        </Coluna>
      </div>
    </div>
  );
}

function Coluna({
  titulo,
  vazio,
  n,
  children,
}: {
  titulo: string;
  vazio: string;
  n: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <h2 className="flex items-baseline justify-between text-2xl font-semibold">
        {titulo}
        <span className="text-xl text-tinta-suave tabular-nums">{n}</span>
      </h2>
      {n === 0 ? (
        <p className="rounded-lg border border-dashed border-borda p-5 text-lg text-tinta-suave">
          {vazio}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">{children}</ul>
      )}
    </section>
  );
}

function Cartao({
  c,
  atrasado = false,
  valor = false,
  children,
}: {
  c: ComandaResumo;
  atrasado?: boolean;
  valor?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border bg-superficie p-4',
        atrasado ? 'border-aviso-texto/70' : 'border-borda',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-xl font-semibold">{c.cliente ?? 'Sem cliente'}</p>
        <p className="text-lg text-tinta-suave">
          {c.inicio && formatarHora(c.inicio)} · {c.profissional}
          {atrasado && <span className="font-semibold text-aviso-texto"> · atrasado</span>}
        </p>
        {valor && <p className="text-lg font-semibold">{formatarMoeda(c.totalLiquido)}</p>}
      </div>
      {children}
    </li>
  );
}

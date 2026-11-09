'use client';

// Tutorial guiado no Início (Etapa 23): os primeiros passos se marcam sozinhos pelo que a
// barbearia já fez. Cada passo leva à tela e ao artigo da central de ajuda. Some quando termina;
// dá para esconder antes (fica guardado neste aparelho).
import {
  DEFINICAO_PASSOS,
  PASSOS_INICIAIS,
  progressoPrimeirosPassos,
  type EstadoPrimeirosPassos,
} from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';

const CHAVE = 'pf-primeiros-passos-oculto';
const lerOculto = () => {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
};

export function PrimeirosPassos() {
  const [oculto, setOculto] = useState(lerOculto);
  const [aberto, setAberto] = useState(true);
  const estado = useQuery({
    queryKey: ['primeiros-passos'],
    queryFn: () => api<EstadoPrimeirosPassos>('conta/primeiros-passos'),
    enabled: !oculto,
    staleTime: 30_000,
  });
  if (oculto || !estado.data) return null;
  const { feitos, total, proximo } = progressoPrimeirosPassos(estado.data);
  if (!proximo) return null;

  return (
    <section
      aria-labelledby="titulo-primeiros-passos"
      className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-modulo-texto">
            Tutorial
          </p>
          <h2 id="titulo-primeiros-passos" className="text-xl font-semibold">
            Primeiros passos: {feitos} de {total}
          </h2>
          <p className="text-sm text-tinta-suave">
            Cada passo se marca sozinho quando você faz. Próximo:{' '}
            <strong className="text-tinta">{DEFINICAO_PASSOS[proximo].titulo}</strong>.
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls="lista-primeiros-passos"
            className="flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-semibold text-tinta-suave hover:text-tinta"
          >
            {aberto ? 'Recolher' : 'Ver passos'}
            <ChevronDown
              aria-hidden
              className={`size-4 transition-transform ${aberto ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(CHAVE, '1');
              } catch {
                /* sem armazenamento: some só nesta visita */
              }
              setOculto(true);
            }}
            className="min-h-11 rounded-md px-3 text-sm font-semibold text-tinta-suave hover:text-tinta"
          >
            Esconder
          </button>
        </div>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-borda"
        role="progressbar"
        aria-label="Primeiros passos feitos"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitos}
      >
        <div className="h-full bg-acao" style={{ width: `${(feitos / total) * 100}%` }} />
      </div>
      {aberto && (
        <ol id="lista-primeiros-passos" className="flex flex-col divide-y divide-borda">
          {PASSOS_INICIAIS.map((p) => {
            const d = DEFINICAO_PASSOS[p];
            const feito = estado.data[p];
            return (
              <li key={p} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  aria-hidden
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    feito ? 'border-acao bg-acao text-[#121211]' : 'border-borda-forte'
                  } ${p === proximo ? 'border-modulo' : ''}`}
                >
                  {feito && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`font-semibold ${feito ? 'text-tinta-suave line-through' : ''}`}>
                    {d.titulo}
                    <span className="sr-only">{feito ? ' (feito)' : ' (a fazer)'}</span>
                  </span>
                  {!feito && <span className="text-sm text-tinta-suave">{d.porque}</span>}
                </span>
                {!feito && (
                  <span className="flex gap-3 text-sm">
                    <Link
                      href={`/ajuda?artigo=${d.artigo}`}
                      className="font-semibold text-tinta-suave underline underline-offset-4 hover:text-tinta"
                    >
                      Como fazer
                    </Link>
                    <Link
                      href={d.rota}
                      className="font-semibold text-tinta underline underline-offset-4 hover:decoration-modulo"
                    >
                      Fazer agora
                    </Link>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

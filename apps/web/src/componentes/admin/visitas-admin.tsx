'use client';

// O que o visitante faz na página de vendas (pedido do dono em 13/11): o funil de hoje ou dos
// últimos 7 dias, até onde rolam, em que clicam e de onde vêm. Medição própria, anônima.
import {
  ALVOS_CLIQUE,
  MARCAS_ROLAGEM,
  ROTULO_ALVO,
  type PainelVisitas,
  type ResumoVisitas,
} from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Estado } from '../pagina';
import { adminApi } from './admin-api';

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const parte = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : '–');

/** Uma linha com barra: o rótulo, o número e a parte do total. */
function Barra({ rotulo, n, total }: { rotulo: string; n: number; total: number }) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3">
      <span className="truncate">{rotulo}</span>
      <span className="h-3 rounded-full bg-superficie-2" aria-hidden>
        <span
          className="block h-full rounded-full bg-acao"
          style={{ width: total ? `${(n / total) * 100}%` : 0 }}
        />
      </span>
      <span className="text-right tabular-nums">
        {n} <span className="text-tinta-suave">({parte(n, total)})</span>
      </span>
    </li>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
      <h3 className="font-semibold">{titulo}</h3>
      {children}
    </section>
  );
}

function Resumo({ r }: { r: ResumoVisitas }) {
  if (r.visitas === 0)
    return <p className="text-tinta-suave">Nenhuma visita neste período ainda.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Bloco titulo="Funil">
        <ol className="flex flex-col gap-2" aria-label="Funil da página de vendas">
          {r.funil.map((e) => (
            <Barra key={e.etapa} rotulo={e.etapa} n={e.visitas} total={r.visitas} />
          ))}
        </ol>
        <p className="text-sm text-tinta-suave">
          {r.novas} de {r.visitas} visitas são de quem veio pela primeira vez (só conta quem aceitou
          os cookies).
        </p>
      </Bloco>
      <Bloco titulo="Até onde rolaram">
        <ul className="flex flex-col gap-2">
          {MARCAS_ROLAGEM.map((m) => (
            <Barra key={m} rotulo={`${m}% da página`} n={r.rolagem[m]} total={r.visitas} />
          ))}
        </ul>
      </Bloco>
      <Bloco titulo="Em que clicaram">
        <ul className="flex flex-col gap-2">
          {ALVOS_CLIQUE.map((a) => (
            <Barra key={a} rotulo={ROTULO_ALVO[a]} n={r.cliques[a]} total={r.visitas} />
          ))}
        </ul>
      </Bloco>
      <Bloco titulo="De onde vieram">
        <ul className="flex flex-col gap-2">
          {r.origens.map((o) => (
            <Barra key={o.origem} rotulo={o.origem} n={o.visitas} total={r.visitas} />
          ))}
        </ul>
      </Bloco>
    </div>
  );
}

function PorDia({ dias }: { dias: PainelVisitas['porDia'] }) {
  return (
    <table className="w-full max-w-md text-left">
      <caption className="mb-2 text-left font-semibold">Visitas por dia</caption>
      <thead>
        <tr className="border-b border-borda text-sm text-tinta-suave">
          <th scope="col" className="py-2 font-medium">
            Dia
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Visitas
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Primeira vez
          </th>
        </tr>
      </thead>
      <tbody>
        {dias.map((d) => (
          <tr key={d.dia} className="border-b border-borda">
            <th scope="row" className="py-2 font-normal">
              {ddmm(d.dia)}
            </th>
            <td className="py-2 text-right tabular-nums">{d.visitas}</td>
            <td className="py-2 text-right tabular-nums">{d.novas}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VisitasSiteAdmin() {
  const [periodo, setPeriodo] = useState<'hoje' | 'semana'>('hoje');
  const v = useQuery({
    queryKey: ['admin', 'visitas'],
    queryFn: () => adminApi<PainelVisitas>('visitas'),
    refetchInterval: 60_000,
  });
  return (
    <section aria-labelledby="titulo-visitas" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-visitas" className="text-2xl font-semibold">
            Visitantes da página de vendas
          </h2>
          <p className="text-sm text-tinta-suave">
            Quem entrou, até onde rolou, em que clicou e de onde veio. Medição nossa, sem dado
            pessoal; quem liga o &ldquo;não rastrear&rdquo; não entra na conta.
          </p>
        </div>
        <div role="group" aria-label="Período" className="flex gap-1">
          {(
            [
              ['hoje', 'Hoje'],
              ['semana', '7 dias'],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={periodo === id}
              onClick={() => setPeriodo(id)}
              className="min-h-11 rounded-md border border-borda px-4 font-semibold aria-pressed:bg-superficie-2 aria-pressed:text-tinta text-tinta-suave hover:text-tinta focus-visible:outline-2 focus-visible:outline-foco"
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>
      <Estado consulta={v}>
        {() => (
          <div className="flex flex-col gap-6">
            <p className="text-lg">
              <span className="font-semibold tabular-nums">{v.data![periodo].visitas}</span>{' '}
              {v.data![periodo].visitas === 1 ? 'visita' : 'visitas'}{' '}
              {periodo === 'hoje' ? 'hoje' : 'nos últimos 7 dias'}
            </p>
            <Resumo r={v.data![periodo]} />
            {periodo === 'semana' && <PorDia dias={v.data!.porDia} />}
          </div>
        )}
      </Estado>
    </section>
  );
}

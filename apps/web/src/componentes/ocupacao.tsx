'use client';

import {
  extremosDoMapa,
  NOME_FAIXA,
  NOMES_DIAS,
  type CelulaDoMapa,
  type OcupacaoDaUnidade,
} from '@pente-fino/shared';

const pct = (f: number) => `${Math.round(f * 100)}%`;
const hora = (h: number) => `${String(h).padStart(2, '0')}h`;
const horasTexto = (min: number) => {
  const h = Math.floor(min / 60);
  return `${h.toLocaleString('pt-BR')} h`;
};
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Quanto da agenda da unidade foi ocupado no período, e em que faixa do dia (Resultados do mês). */
export function CardOcupacao({ o }: { o: OcupacaoDaUnidade }) {
  if (o.total.disponivelMin === 0) return null;
  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5"
      aria-labelledby="titulo-ocupacao"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="titulo-ocupacao"
          className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
        >
          Ocupação da agenda no mês
        </h2>
        <span className="text-sm text-tinta-suave">
          {horasTexto(o.total.agendadoMin)} marcadas de {horasTexto(o.total.disponivelMin)} de
          agenda
          {o.capacidade > 1 ? ` · ${o.capacidade} cadeiras` : ''}
        </span>
      </div>
      <p className="font-denso text-4xl font-semibold tabular-nums">{pct(o.total.fracao)}</p>
      <ul className="grid gap-3 sm:grid-cols-3" aria-label="Ocupação por faixa do dia">
        {o.porFaixa.map((f) => (
          <li key={f.faixa} className="flex flex-col gap-1">
            <span className="flex justify-between text-sm">
              <span>{NOME_FAIXA[f.faixa]}</span>
              <strong className="tabular-nums">{pct(f.ocupacao.fracao)}</strong>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden>
              <span
                className="block h-full rounded-full bg-acao"
                style={{ width: pct(Math.min(1, f.ocupacao.fracao)) }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const rotuloCelula = (c: CelulaDoMapa) => `${NOMES_DIAS[c.diaSemana]}, ${hora(c.hora)}`;

/**
 * Mapa da semana: dia da semana × hora, com a ocupação das últimas semanas. Mostra onde há
 * horário sobrando (para promoção ou folga) e onde falta cadeira.
 */
export function MapaDaSemana({ o }: { o: OcupacaoDaUnidade }) {
  if (o.celulas.length === 0)
    return <p className="text-tinta-suave">Sem expediente cadastrado no período.</p>;
  const dias = [...new Set(o.celulas.map((c) => c.diaSemana))].sort(
    (a, b) => ((a + 6) % 7) - ((b + 6) % 7),
  );
  const horas = o.celulas.map((c) => c.hora);
  const de = Math.min(...horas);
  const ate = Math.max(...horas);
  const linhas = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const celula = (ds: number, h: number) =>
    o.celulas.find((c) => c.diaSemana === ds && c.hora === h);
  const { maisVazias, maisCheias } = extremosDoMapa(o.celulas);
  // A cor usa a faixa toda: a hora mais cheia do período fica na cor mais forte.
  const teto = Math.max(0.5, ...o.celulas.map((c) => Math.min(1, c.fracao)));
  const mistura = (f: number) => Math.round(10 + (Math.min(1, f) / teto) * 85);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-88 border-separate border-spacing-1 text-sm">
          <caption className="sr-only">
            Ocupação por dia da semana e hora, de {o.de} a {o.ate}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-12" />
              {dias.map((ds) => (
                <th key={ds} scope="col" className="font-semibold text-tinta-suave">
                  <abbr title={NOMES_DIAS[ds]} className="no-underline">
                    {DIAS_CURTOS[ds]}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((h) => (
              <tr key={h}>
                <th
                  scope="row"
                  className="pr-1 text-right font-normal text-tinta-suave tabular-nums"
                >
                  {hora(h)}
                </th>
                {dias.map((ds) => {
                  const c = celula(ds, h);
                  if (!c) return <td key={ds} className="rounded-sm" aria-label="Sem expediente" />;
                  const m = mistura(c.fracao);
                  const forte = m >= 55;
                  return (
                    <td
                      key={ds}
                      className={`rounded-sm py-1.5 text-center tabular-nums ${forte ? 'text-sobre-acao' : 'text-tinta'}`}
                      style={{
                        background: `color-mix(in oklch, var(--acao) ${m}%, var(--superficie-2))`,
                      }}
                      title={`${rotuloCelula(c)}: ${pct(c.fracao)}`}
                    >
                      {pct(c.fracao)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-2 text-sm text-tinta-suave" aria-hidden>
        Vazio
        <span
          className="h-2 w-24 rounded-full"
          style={{
            background:
              'linear-gradient(to right, color-mix(in oklch, var(--acao) 10%, var(--superficie-2)), var(--acao))',
          }}
        />
        Mais cheio do período ({pct(teto)})
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Extremos titulo="Mais vazios" celulas={maisVazias} />
        <Extremos titulo="Mais cheios" celulas={maisCheias} />
      </div>
    </div>
  );
}

function Extremos({ titulo, celulas }: { titulo: string; celulas: CelulaDoMapa[] }) {
  if (celulas.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-semibold">{titulo}</h3>
      <ul aria-label={titulo} className="flex flex-col gap-0.5 text-sm">
        {celulas.map((c) => (
          <li key={`${c.diaSemana}-${c.hora}`} className="flex justify-between gap-4">
            <span>{rotuloCelula(c)}</span>
            <span className="tabular-nums text-tinta-suave">{pct(c.fracao)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import {
  formatarMoeda,
  NOME_PLANO,
  NOME_SITUACAO_NA_PLATAFORMA,
  type MetricasDaPlataforma,
  type SituacaoNaPlataforma,
} from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { Estado } from '../pagina';
import { adminApi } from './admin-api';

const pct = (f: number) => `${Math.round(f * 100)}%`;
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const ORDEM_SITUACAO: SituacaoNaPlataforma[] = [
  'teste',
  'em_dia',
  'cortesia',
  'ativa_sem_cobranca',
  'em_atraso',
  'teste_vencido',
  'bloqueada',
  'suspensa',
  'cancelada',
];

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-borda bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</dt>
      <dd className="font-denso text-3xl font-semibold tabular-nums">{valor}</dd>
      {detalhe && <dd className="text-sm text-tinta-suave">{detalhe}</dd>}
    </div>
  );
}

/** Contas novas por dia (30 dias): uma série, barras finas, rótulo ao passar o mouse. */
function NovasPorDia({ dias }: { dias: MetricasDaPlataforma['novas']['porDia'] }) {
  const maximo = Math.max(1, ...dias.map((d) => d.contas));
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        Contas novas por dia · últimos 30 dias
      </figcaption>
      <div className="flex h-28 items-end gap-0.5 border-b border-borda" aria-hidden>
        {dias.map((d) => (
          <div
            key={d.dia}
            className="group relative flex h-full flex-1 items-end"
            title={`${ddmm(d.dia)}: ${d.contas} ${d.contas === 1 ? 'conta' : 'contas'}`}
          >
            <div
              className="w-full rounded-t-[4px] bg-acao group-hover:opacity-80"
              style={{ height: d.contas ? `${(d.contas / maximo) * 100}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-tinta-suave tabular-nums" aria-hidden>
        <span>{ddmm(dias[0]!.dia)}</span>
        <span>máx. {maximo}</span>
        <span>{ddmm(dias.at(-1)!.dia)}</span>
      </div>
      <table className="sr-only">
        <caption>Contas novas por dia</caption>
        <tbody>
          {dias.map((d) => (
            <tr key={d.dia}>
              <th scope="row">{ddmm(d.dia)}</th>
              <td>{d.contas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Números do negócio (só o admin): contas, receita recorrente, conversão e cancelamentos. */
export function MetricasAdmin() {
  const m = useQuery({
    queryKey: ['admin', 'metricas'],
    queryFn: () => adminApi<MetricasDaPlataforma>('metricas'),
  });
  return (
    <section aria-labelledby="titulo-negocio" className="flex flex-col gap-4">
      <h2 id="titulo-negocio" className="text-2xl font-semibold">
        Números do negócio
      </h2>
      <Estado consulta={m}>
        {() => {
          const d = m.data!;
          return (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Numero
                  rotulo="Receita recorrente (MRR)"
                  valor={formatarMoeda(d.receita.mrr)}
                  detalhe={`${d.receita.pagantes} ${d.receita.pagantes === 1 ? 'conta pagante' : 'contas pagantes'} · ticket ${formatarMoeda(d.receita.ticketMedio)}`}
                />
                <Numero
                  rotulo="Previsão do próximo mês"
                  valor={formatarMoeda(d.receita.previsaoProximoMes)}
                  detalhe="MRR + testes que terminam em 30 dias × conversão"
                />
                <Numero
                  rotulo="Conversão do teste"
                  valor={d.conversao.elegiveis ? pct(d.conversao.taxa) : '—'}
                  detalhe={`${d.conversao.assinaram} de ${d.conversao.elegiveis} que terminaram o teste`}
                />
                <Numero
                  rotulo="Cancelamentos no mês"
                  valor={String(d.cancelamentos.noMes)}
                  detalhe={`${pct(d.cancelamentos.taxa)} dos pagantes · ${d.renovaram} já renovaram`}
                />
                <Numero
                  rotulo="Contas novas"
                  valor={String(d.novas.noMes)}
                  detalhe={`no mês · ${d.novas.ultimos7Dias} em 7 dias · ${d.novas.hoje} hoje`}
                />
                <Numero
                  rotulo="MRR por plano"
                  valor={formatarMoeda(d.receita.porPlano.premium)}
                  detalhe={`${NOME_PLANO.premium} · ${NOME_PLANO.pro} ${formatarMoeda(d.receita.porPlano.pro)} · ${NOME_PLANO.basico} ${formatarMoeda(d.receita.porPlano.basico)}`}
                />
                <Numero
                  rotulo="Cobrança automática"
                  valor={formatarMoeda(d.receita.porForma.automatica)}
                  detalhe={`manual (vendedor) ${formatarMoeda(d.receita.porForma.manual)}`}
                />
                <Numero
                  rotulo="Contas"
                  valor={String(d.contas.total)}
                  detalhe={
                    d.contas.internas > 0
                      ? `todas as situações · fora ${d.contas.internas} interna${d.contas.internas === 1 ? '' : 's'}`
                      : 'todas as situações'
                  }
                />
              </dl>
              <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                <NovasPorDia dias={d.novas.porDia} />
                <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                    Contas por situação
                  </h3>
                  <ul className="flex flex-col gap-1 text-sm" aria-label="Contas por situação">
                    {ORDEM_SITUACAO.filter((s) => d.contas.porSituacao[s] > 0).map((s) => (
                      <li key={s} className="flex justify-between gap-3">
                        <span>{NOME_SITUACAO_NA_PLATAFORMA[s]}</span>
                        <span className="tabular-nums">{d.contas.porSituacao[s]}</span>
                      </li>
                    ))}
                  </ul>
                  {d.cancelamentos.motivos.length > 0 && (
                    <>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                        Motivos de cancelamento no mês
                      </h3>
                      <ul className="flex flex-col gap-1 text-sm">
                        {d.cancelamentos.motivos.map((x) => (
                          <li key={x.motivo} className="flex justify-between gap-3">
                            <span>{x.motivo}</span>
                            <span className="tabular-nums">{x.contas}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </Estado>
    </section>
  );
}

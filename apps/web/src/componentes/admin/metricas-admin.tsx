'use client';

import {
  formatarMoeda,
  NOME_PERIODO_METRICAS,
  NOME_PLANO,
  NOME_SITUACAO_NA_PLATAFORMA,
  type MetricasDaPlataforma,
  type PeriodoMetricas,
  type ResumoFunil,
  type SituacaoNaPlataforma,
} from '@pente-fino/shared';
import { Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Estado } from '../pagina';
import { adminApi } from './admin-api';
import { MetricasSaasAdmin } from './metricas-saas-admin';

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

/** Situação nos números → filtro da lista de contas (#contas?situacao=…). */
const STATUS_DA_SITUACAO: Record<SituacaoNaPlataforma, string> = {
  teste: 'teste',
  teste_vencido: 'teste',
  em_dia: 'ativa',
  em_atraso: 'ativa',
  ativa_sem_cobranca: 'ativa',
  cortesia: 'ativa',
  bloqueada: 'suspensa',
  suspensa: 'suspensa',
  cancelada: 'cancelada',
};

function Numero({
  rotulo,
  valor,
  detalhe,
  onClick,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  /** Admin U1: leva para a lista filtrada. */
  onClick?: () => void;
}) {
  const classe = 'flex flex-col gap-1 rounded-lg border border-borda bg-superficie p-4 text-left';
  const conteudo = (
    <>
      <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</dt>
      <dd className="font-denso text-3xl font-semibold tabular-nums">{valor}</dd>
      {detalhe && <dd className="text-sm text-tinta-suave">{detalhe}</dd>}
    </>
  );
  return onClick ? (
    <div className={`${classe} relative hover:border-borda-forte`}>
      {conteudo}
      <button
        type="button"
        onClick={onClick}
        aria-label={`${rotulo}: ver na lista de contas`}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-foco"
      />
    </div>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Contas novas por dia (30 dias): uma série, barras finas, rótulo ao passar o mouse. */
function NovasPorDia({
  dias,
  rotulo,
}: {
  dias: MetricasDaPlataforma['novas']['porDia'];
  rotulo: string;
}) {
  const maximo = Math.max(1, ...dias.map((d) => d.contas));
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        Contas novas por dia · {rotulo}
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
export function MetricasAdmin({ onIrPara }: { onIrPara: (aba: string) => void }) {
  // Admin U1: período das novas, dos cancelamentos e do gráfico.
  const [periodo, setPeriodo] = useState<PeriodoMetricas>('mes');
  const m = useQuery({
    queryKey: ['admin', 'metricas', periodo],
    queryFn: () => adminApi<MetricasDaPlataforma>(`metricas?periodo=${periodo}`),
  });
  const contas = (situacao?: string) =>
    onIrPara(situacao ? `contas?situacao=${situacao}` : 'contas');
  const noPeriodo = NOME_PERIODO_METRICAS[periodo].toLowerCase();
  return (
    <section aria-labelledby="titulo-negocio" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="titulo-negocio" className="text-2xl font-semibold">
          Números do negócio
        </h2>
        <Selecao
          id="metricas-periodo"
          rotulo="Período"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as PeriodoMetricas)}
          opcoes={(Object.keys(NOME_PERIODO_METRICAS) as PeriodoMetricas[]).map((p) => ({
            valor: p,
            rotulo: NOME_PERIODO_METRICAS[p],
          }))}
        />
      </div>
      <Estado consulta={m}>
        {() => {
          const d = m.data!;
          const emTeste = d.contas.porSituacao.teste;
          return (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Numero
                  rotulo="Receita recorrente (MRR)"
                  valor={formatarMoeda(d.receita.mrr)}
                  detalhe={
                    d.receita.pagantes === 0
                      ? `Nenhuma conta paga ainda · contas em teste: ${emTeste}`
                      : `${d.receita.pagantes} ${d.receita.pagantes === 1 ? 'conta pagante' : 'contas pagantes'} · ticket ${formatarMoeda(d.receita.ticketMedio)}`
                  }
                  onClick={() => contas('ativa')}
                />
                <Numero
                  rotulo="Previsão do próximo mês"
                  valor={formatarMoeda(d.receita.previsaoProximoMes)}
                  detalhe="MRR + testes que terminam em 30 dias × conversão"
                />
                <Numero
                  rotulo="Conversão do teste"
                  valor={d.conversao.elegiveis ? pct(d.conversao.taxa) : '—'}
                  detalhe={
                    d.conversao.elegiveis
                      ? `${d.conversao.assinaram} de ${d.conversao.elegiveis} que terminaram o teste`
                      : `Nenhum teste terminou ainda · em teste agora: ${emTeste}`
                  }
                  onClick={() => contas('teste')}
                />
                <Numero
                  rotulo="Cancelamentos"
                  valor={String(d.cancelamentos.noPeriodo)}
                  detalhe={
                    d.cancelamentos.noPeriodo
                      ? `${noPeriodo} · ${pct(d.cancelamentos.taxa)} dos pagantes · ${d.renovaram} já renovaram`
                      : `Nenhum cancelamento (${noPeriodo}) · ${d.renovaram} já renovaram`
                  }
                  onClick={() => contas('cancelada')}
                />
                <Numero
                  rotulo="Contas novas"
                  valor={String(d.novas.noPeriodo)}
                  detalhe={
                    d.novas.noPeriodo
                      ? `${noPeriodo} · ${d.novas.ultimos7Dias} em 7 dias · ${d.novas.hoje} hoje`
                      : `Nenhuma conta nova (${noPeriodo}). Veja a origem dos cadastros em Vendas.`
                  }
                  onClick={() => contas()}
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
                  onClick={() => contas()}
                  valor={String(d.contas.total)}
                  detalhe={
                    d.contas.internas > 0
                      ? `todas as situações · fora ${d.contas.internas} interna${d.contas.internas === 1 ? '' : 's'}`
                      : 'todas as situações'
                  }
                />
              </dl>
              <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                <div className="flex flex-col gap-3">
                  <NovasPorDia dias={d.novas.porDia} rotulo={noPeriodo} />
                  {/* Admin F2: de onde vieram as contas novas do período. */}
                  <section
                    aria-labelledby="titulo-novas-origem"
                    className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4"
                  >
                    <h3
                      id="titulo-novas-origem"
                      className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
                    >
                      Contas novas por origem ({noPeriodo})
                    </h3>
                    {d.novas.porOrigem.length === 0 ? (
                      <p className="text-sm text-tinta-suave">Nenhuma conta nova no período.</p>
                    ) : (
                      <ul className="flex flex-col gap-1 text-sm">
                        {d.novas.porOrigem.map((o) => (
                          <li key={o.origem} className="flex justify-between gap-3">
                            <span>{o.origem}</span>
                            <span className="tabular-nums">{o.contas}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                    Contas por situação
                  </h3>
                  <ul className="flex flex-col gap-1 text-sm" aria-label="Contas por situação">
                    {ORDEM_SITUACAO.filter((s) => d.contas.porSituacao[s] > 0).map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => contas(STATUS_DA_SITUACAO[s])}
                          className="flex w-full justify-between gap-3 rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco"
                        >
                          <span>{NOME_SITUACAO_NA_PLATAFORMA[s]}</span>
                          <span className="tabular-nums">{d.contas.porSituacao[s]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {d.cancelamentos.motivos.length > 0 && (
                    <>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                        Motivos de cancelamento ({noPeriodo})
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
      <FunilAtivacao />
      {/* Admin F7: churn, MRR por tipo, LTV e coortes. */}
      <MetricasSaasAdmin />
    </section>
  );
}

const PERIODOS_FUNIL = {
  todos: 'Desde o início',
  '90dias': 'Cadastros dos últimos 90 dias',
  '30dias': 'Cadastros dos últimos 30 dias',
} as const;

/**
 * Admin F1: funil de ativação. Quantas contas já fizeram cada etapa, do cadastro ao pagamento
 * (sem as internas). A barra mostra a fatia dos cadastros; a queda entre etapas é onde ajudar.
 */
function FunilAtivacao() {
  const [periodo, setPeriodo] = useState<keyof typeof PERIODOS_FUNIL>('todos');
  const f = useQuery({
    queryKey: ['admin', 'funil', periodo],
    queryFn: () => adminApi<ResumoFunil>(`funil?periodo=${periodo}`),
  });
  return (
    <section
      aria-labelledby="titulo-funil"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 id="titulo-funil" className="text-lg font-semibold">
          Funil de ativação
        </h3>
        <Selecao
          id="funil-periodo"
          rotulo="Contas"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as keyof typeof PERIODOS_FUNIL)}
          opcoes={(Object.keys(PERIODOS_FUNIL) as (keyof typeof PERIODOS_FUNIL)[]).map((p) => ({
            valor: p,
            rotulo: PERIODOS_FUNIL[p],
          }))}
        />
      </div>
      <Estado consulta={f}>
        {() => {
          const d = f.data!;
          if (d.total === 0)
            return <p className="text-sm text-tinta-suave">Nenhum cadastro neste período.</p>;
          return (
            <ol className="flex flex-col gap-2" aria-label="Etapas do funil">
              {d.etapas.map((e, i) => {
                const anterior = i > 0 ? d.etapas[i - 1]!.contas : null;
                const perdeu = anterior !== null ? anterior - e.contas : 0;
                return (
                  <li
                    key={e.etapa}
                    className="grid gap-1 sm:grid-cols-[12rem_1fr_7rem] sm:items-center"
                  >
                    <span className="text-sm">{e.nome}</span>
                    <span aria-hidden className="h-3 overflow-hidden rounded-full bg-superficie-3">
                      <span
                        className="block h-full rounded-full bg-modulo"
                        style={{ width: `${e.pct}%` }}
                      />
                    </span>
                    <span className="text-sm tabular-nums">
                      {e.contas} · {e.pct}%
                      {perdeu > 0 && (
                        <span className="sr-only">, {perdeu} a menos que a etapa anterior</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          );
        }}
      </Estado>
      <p className="text-xs text-tinta-suave">
        Contas que já fizeram cada etapa, sem as internas. A etapa de cada conta aparece na ficha
        dela.
      </p>
    </section>
  );
}

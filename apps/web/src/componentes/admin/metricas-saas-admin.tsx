'use client';

// Admin F7: métricas de SaaS (só o admin). MRR mês a mês com o que entrou e saiu, churn, ARPA,
// LTV, MRR por plano e coortes por mês de cadastro. Só meses fechados.
import { formatarMoeda, NOME_PLANO, PLANOS, type MetricasSaas } from '@pente-fino/shared';
import { useQuery } from '@tanstack/react-query';
import { Estado, Tabela, td, th } from '../pagina';
import { adminApi } from './admin-api';

const pct = (f: number | null) => (f === null ? '—' : `${Math.round(f * 100)}%`);
const NOME_MES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];
const mesCurto = (m: string) => `${NOME_MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-borda bg-superficie p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">{rotulo}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{valor}</dd>
      <dd className="text-xs text-tinta-suave">{detalhe}</dd>
    </div>
  );
}

export function MetricasSaasAdmin() {
  const q = useQuery({
    queryKey: ['admin', 'metricas', 'saas'],
    queryFn: () => adminApi<MetricasSaas>('metricas/saas'),
  });
  return (
    <section aria-labelledby="titulo-saas" className="flex flex-col gap-4">
      <div>
        <h3 id="titulo-saas" className="text-lg font-semibold">
          Métricas de SaaS
        </h3>
        <p className="text-sm text-tinta-suave">
          Das faturas pagas, só meses fechados (o mês corrente entra quando acabar). Fatura anual
          conta 1/12 por mês. Contas internas ficam de fora.
        </p>
      </div>
      <Estado consulta={q}>
        {() => {
          const d = q.data!;
          const ultimo = d.meses.at(-1)!;
          const seis = d.meses.slice(-6);
          return (
            <>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Numero
                  rotulo={`MRR de ${mesCurto(ultimo.mes)}`}
                  valor={formatarMoeda(ultimo.mrr)}
                  detalhe={`${ultimo.pagantes} ${ultimo.pagantes === 1 ? 'conta pagante' : 'contas pagantes'}`}
                />
                <Numero
                  rotulo="ARPA"
                  valor={formatarMoeda(d.arpa)}
                  detalhe="MRR médio por conta pagante"
                />
                <Numero
                  rotulo="Churn mensal"
                  valor={pct(d.churnMedio)}
                  detalhe="média dos últimos 6 meses fechados"
                />
                <Numero
                  rotulo="LTV"
                  valor={d.ltv === null ? '—' : formatarMoeda(d.ltv)}
                  detalhe="ARPA ÷ churn mensal"
                />
              </dl>
              <Tabela rotulo="MRR mês a mês">
                <thead>
                  <tr className="border-b border-borda">
                    {[
                      'Mês',
                      'MRR',
                      'Novo',
                      'Upgrade',
                      'Downgrade',
                      'Perdido',
                      'Pagantes',
                      'Churn',
                    ].map((c) => (
                      <th key={c} scope="col" className={th}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seis.map((m) => (
                    <tr key={m.mes} className="border-b border-borda">
                      <th scope="row" className={`${td} font-medium`}>
                        {mesCurto(m.mes)}
                      </th>
                      <td className={`${td} tabular-nums`}>{formatarMoeda(m.mrr)}</td>
                      <td className={`${td} tabular-nums text-acao-texto`}>
                        {m.novo ? `+${formatarMoeda(m.novo)}` : '—'}
                      </td>
                      <td className={`${td} tabular-nums text-acao-texto`}>
                        {m.upgrade ? `+${formatarMoeda(m.upgrade)}` : '—'}
                      </td>
                      <td className={`${td} tabular-nums text-perigo-texto`}>
                        {m.downgrade ? `−${formatarMoeda(m.downgrade)}` : '—'}
                      </td>
                      <td className={`${td} tabular-nums text-perigo-texto`}>
                        {m.perdido ? `−${formatarMoeda(m.perdido)}` : '—'}
                      </td>
                      <td className={`${td} tabular-nums`}>{m.pagantes}</td>
                      <td className={`${td} tabular-nums`}>{pct(m.churn)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
                <div className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                    MRR por plano ({mesCurto(ultimo.mes)})
                  </h4>
                  <ul className="flex flex-col gap-1 text-sm">
                    {PLANOS.map((p) => (
                      <li key={p} className="flex justify-between gap-3">
                        <span>
                          {NOME_PLANO[p]} · {d.porPlano[p].contas}{' '}
                          {d.porPlano[p].contas === 1 ? 'conta' : 'contas'}
                        </span>
                        <span className="tabular-nums">
                          {formatarMoeda(d.porPlano[p].mrr)}
                          {d.porPlano[p].contas > 0 &&
                            ` · ticket ${formatarMoeda(Math.round(d.porPlano[p].mrr / d.porPlano[p].contas))}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Tabela rotulo="Coortes por mês de cadastro">
                  <thead>
                    <tr className="border-b border-borda">
                      <th scope="col" className={th}>
                        Cadastro
                      </th>
                      <th scope="col" className={th}>
                        Contas
                      </th>
                      {[0, 1, 2, 3, 4, 5].map((k) => (
                        <th key={k} scope="col" className={th}>
                          {k === 0 ? 'Mês 0' : `+${k}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.coortes.map((c) => (
                      <tr key={c.mes} className="border-b border-borda">
                        <th scope="row" className={`${td} font-medium`}>
                          {mesCurto(c.mes)}
                        </th>
                        <td className={`${td} tabular-nums`}>{c.contas}</td>
                        {c.pagando.map((p, k) => (
                          <td key={k} className={`${td} tabular-nums`}>
                            {p === null ? '' : c.contas ? pct(p) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </div>
              <p className="text-xs text-tinta-suave">
                Coorte: das contas criadas no mês, a fatia que estava pagando em cada mês seguinte.
              </p>
            </>
          );
        }}
      </Estado>
    </section>
  );
}

'use client';

import {
  formatarMoeda,
  METRICAS_REDE,
  NOME_METRICA_REDE,
  type MetricaRede,
  type NumerosDaRede,
  type PainelDaRede,
} from '@pente-fino/shared';
import { EstadoVazio, cn } from '@pente-fino/ui';
import { Network } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { chavesResultados } from '@/lib/consultas';
import { Estado, Tabela, td, th } from './pagina';

const pct = (f: number) => `${Math.round(f * 100)}%`;
const nota = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1 });

const negativo = (n: NumerosDaRede, m: MetricaRede) => m === 'lucro' && n.lucro < 0;

/** Texto de cada indicador (o mesmo na tabela e nos cartões do celular). */
function texto(n: NumerosDaRede, m: MetricaRede): string {
  switch (m) {
    case 'faturamento':
      return formatarMoeda(n.faturamento);
    case 'lucro':
      return formatarMoeda(n.lucro);
    case 'ticketMedio':
      return n.clientes ? formatarMoeda(n.ticketMedio) : '—';
    case 'ocupacao':
      return n.ocupacao.disponivelMin ? pct(n.ocupacao.fracao) : '—';
    case 'nota':
      return nota(n.nota.media);
    case 'retorno':
      return n.retorno.atendidos ? pct(n.retorno.taxa) : '—';
  }
}

/**
 * Unidades lado a lado no período (RF-23, antes "Painel da rede"), dentro de Resultados do mês:
 * a melhor de cada indicador marcada e o total da rede.
 */
export function UnidadesDaRede({ de, ate }: { de: string; ate: string }) {
  const painel = useQuery({
    queryKey: [...chavesResultados.indicadores, 'rede', de, ate],
    queryFn: () => api<PainelDaRede>(`rede?de=${de}&ate=${ate}`),
  });

  return (
    <section aria-labelledby="res-unidades" className="flex flex-col gap-3">
      <h2 id="res-unidades" className="text-lg font-semibold">
        Unidades lado a lado
      </h2>
      <Estado consulta={painel}>
        {() => {
          const p = painel.data!;
          if (p.unidades.length === 0)
            return (
              <EstadoVazio
                icone={Network}
                titulo="Nenhuma unidade ativa"
                texto="Cadastre uma unidade em Configurações."
              />
            );
          const melhor = (id: string, m: MetricaRede) => p.destaques[m] === id;
          return (
            <>
              {/* Computador: tabela lado a lado. */}
              <Tabela rotulo="Unidades da rede no mês" className="hidden md:block">
                <thead>
                  <tr className="border-b border-borda">
                    <th scope="col" className={th}>
                      Unidade
                    </th>
                    {METRICAS_REDE.map((m) => (
                      <th key={m} scope="col" className={cn(th, 'text-right')}>
                        {NOME_METRICA_REDE[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.unidades.map((u) => (
                    <tr key={u.unidadeId} className="border-b border-borda">
                      <th scope="row" className={cn(td, 'font-semibold')}>
                        {u.unidade}
                      </th>
                      {METRICAS_REDE.map((m) => (
                        <td
                          key={m}
                          className={cn(
                            td,
                            'text-right font-denso tabular-nums',
                            melhor(u.unidadeId, m) && 'font-semibold text-acao-texto',
                            negativo(u, m) && 'text-perigo-texto',
                          )}
                        >
                          {texto(u, m)}
                          {melhor(u.unidadeId, m) && (
                            <span className="ml-1 text-xs uppercase" aria-label="melhor da rede">
                              ▲
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {p.unidades.length > 1 && (
                  <tfoot>
                    <tr className="bg-superficie-2">
                      <th scope="row" className={cn(td, 'font-semibold')}>
                        Rede
                      </th>
                      {METRICAS_REDE.map((m) => (
                        <td
                          key={m}
                          className={cn(td, 'text-right font-denso font-semibold tabular-nums')}
                        >
                          {texto(p.rede, m)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </Tabela>
              {/* Celular: um cartão por unidade. */}
              <ul className="flex flex-col gap-3 md:hidden" aria-label="Unidades da rede no mês">
                {[
                  ...p.unidades.map((u) => ({
                    id: u.unidadeId,
                    nome: u.unidade,
                    n: u as NumerosDaRede,
                  })),
                  ...(p.unidades.length > 1 ? [{ id: 'rede', nome: 'Rede', n: p.rede }] : []),
                ].map((c) => (
                  <li key={c.id} className="rounded-lg border border-borda bg-superficie p-4">
                    <h3 className="mb-2 font-semibold">{c.nome}</h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {METRICAS_REDE.map((m) => (
                        <div key={m} className="flex flex-col">
                          <dt className="text-tinta-suave">{NOME_METRICA_REDE[m]}</dt>
                          <dd
                            className={cn(
                              'font-denso text-base tabular-nums',
                              melhor(c.id, m) && 'font-semibold text-acao-texto',
                            )}
                          >
                            {texto(c.n, m)}
                            {melhor(c.id, m) && <span className="ml-1 text-xs"> ▲ melhor</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-tinta-suave">
                Comandas fechadas no mês. Lucro = faturamento − despesas operacionais da unidade (as
                despesas da conta, sem unidade, entram só no lucro da rede). Ocupação até hoje; nota
                da barbearia na pesquisa; retorno = clientes do mês que voltaram no prazo.
              </p>
            </>
          );
        }}
      </Estado>
    </section>
  );
}

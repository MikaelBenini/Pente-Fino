'use client';

// Resultados do mês (dono e gestor): o único lugar com os números do mês. Junta o que antes
// estava espalhado em Métricas e metas, Relatório do mês e Painel da rede, com uma só base de
// comparação (o mês anterior; no mês corrente, os mesmos dias). Abas: visão geral (metas,
// números, frases, 12 meses, unidades e o mês dia a dia), barbeiros, serviços e produtos,
// canais e agenda com avaliações. Baixa tudo em PDF ou planilha.
import {
  compararMeses,
  custoELucroDoBarbeiro,
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  frasesDoMes,
  mesAnteriorDe,
  pontosDoBarbeiro,
  textoDaVariacao,
  type BarbeiroDoMes,
  type FormatoIndicador,
  type LinhaComparativo,
  type RelatorioDoMes,
} from '@pente-fino/shared';
import { Abas, cn, Selecao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Minus,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { limitesDoMes, mesAtual, nomeDoMes } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { SoNoPlano } from '../convite-plano';
import { CabecalhoPagina, Estado } from '../pagina';
import { UnidadesDaRede } from '../unidades-da-rede';
import { AgendaEAvaliacoes, Canais, MetasDoMes, ServicosEProdutos } from './resultados-detalhes';
import { DiaADia } from './resumo-dia';

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const proximoMes = (m: string) => {
  const [a, n] = m.split('-').map(Number) as [number, number];
  return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`;
};

function formatar(v: number | null, f: FormatoIndicador): string {
  if (v === null) return '—';
  if (f === 'moeda') return formatarMoeda(v);
  if (f === 'fracao') return formatarFracao(v, 0);
  if (f === 'nota')
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return formatarNumero(v);
}

const COR_TENDENCIA = {
  melhorou: 'text-acao-texto',
  piorou: 'text-perigo-texto',
  igual: 'text-tinta-suave',
} as const;
const NOME_TENDENCIA = { melhorou: 'melhorou', piorou: 'piorou', igual: 'estável' } as const;

function Variacao({ l }: { l: LinhaComparativo }) {
  // Os dois meses zerados (conta nova): sem seta nem "estável" (painel M2).
  if (l.atual === 0 && l.anterior === 0)
    return <span className="text-sm text-tinta-suave">{textoDaVariacao(l)}</span>;
  const Icone =
    l.tendencia === 'igual' ? Minus : (l.atual ?? 0) > (l.anterior ?? 0) ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-semibold',
        COR_TENDENCIA[l.tendencia],
      )}
    >
      <Icone aria-hidden className="size-4" />
      {textoDaVariacao(l)}
      <span className="sr-only"> ({NOME_TENDENCIA[l.tendencia]})</span>
    </span>
  );
}

const ABAS = ['geral', 'barbeiros', 'itens', 'canais', 'agenda'] as const;
type IdAba = (typeof ABAS)[number];
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function TelaResultados() {
  const { unidadeAtiva, unidades } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const pedidoMes = params.get('mes');
  const pedidoAba = params.get('aba') as IdAba | null;
  const [mes, setMesEstado] = useState(() =>
    pedidoMes && MES.test(pedidoMes) && pedidoMes <= mesAtual() ? pedidoMes : mesAtual(),
  );
  const [aba, setAbaEstado] = useState<IdAba>(() =>
    pedidoAba && ABAS.includes(pedidoAba) ? pedidoAba : 'geral',
  );
  // O endereço guarda o mês e a aba: dá para voltar da ficha do barbeiro no mesmo lugar.
  const guardar = (m: string, a: IdAba) =>
    router.replace(`/resultados?mes=${m}${a === 'geral' ? '' : `&aba=${a}`}`, { scroll: false });
  const setMes = (m: string) => {
    setMesEstado(m);
    guardar(m, aba);
  };
  const setAba = (a: string) => {
    setAbaEstado(a as IdAba);
    guardar(mes, a as IdAba);
  };
  const unidade = unidadeAtiva && unidadeAtiva !== 'todas' ? unidadeAtiva : null;
  const relatorio = useQuery({
    queryKey: ['relatorio', mes, unidade],
    queryFn: () =>
      api<RelatorioDoMes>(`relatorio/mes?mes=${mes}${unidade ? `&unidadeId=${unidade}` : ''}`),
  });
  const ehAtual = mes === mesAtual();
  const [de, ate] = limitesDoMes(mes);
  const variasUnidades = !unidade && unidades.filter((u) => u.ativa).length > 1;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Resultados do mês"
        pergunta={`${maiuscula(nomeDoMes(mes))} comparado com ${nomeDoMes(mesAnteriorDe(mes))}`}
        acao={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMes(mesAnteriorDe(mes))}
              className="grid size-11 place-items-center rounded-md border border-borda hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <span className="min-w-36 text-center font-semibold">{maiuscula(nomeDoMes(mes))}</span>
            <button
              type="button"
              aria-label="Mês seguinte"
              disabled={ehAtual}
              onClick={() => setMes(proximoMes(mes))}
              className="grid size-11 place-items-center rounded-md border border-borda hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco disabled:opacity-40"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </div>
        }
      />
      <Baixar mes={mes} unidade={unidade} />
      {ehAtual && relatorio.data && (
        <p className="text-sm text-tinta-suave">
          O mês ainda não acabou: a comparação é com os mesmos dias do mês anterior (até o dia{' '}
          {Number(relatorio.data.periodoAnterior.ate.slice(8, 10))}).
        </p>
      )}
      <Abas
        rotulo="Resultados do mês"
        atual={aba}
        onTrocar={setAba}
        abas={[
          {
            id: 'geral',
            rotulo: 'Visão geral',
            conteudo: (
              <div className="flex flex-col gap-8">
                <MetasDoMes mes={mes} />
                <Estado consulta={relatorio}>{() => <VisaoGeral r={relatorio.data!} />}</Estado>
                {variasUnidades && (
                  <SoNoPlano recurso="rede">
                    <UnidadesDaRede de={de} ate={ate} />
                  </SoNoPlano>
                )}
                <DiaADia mes={mes} />
              </div>
            ),
          },
          {
            id: 'barbeiros',
            rotulo: 'Barbeiros',
            conteudo: (
              <SoNoPlano recurso="fichaProfissional">
                <Estado consulta={relatorio}>{() => <Barbeiros r={relatorio.data!} />}</Estado>
              </SoNoPlano>
            ),
          },
          {
            id: 'itens',
            rotulo: 'Serviços e produtos',
            conteudo: (
              <Estado consulta={relatorio}>
                {() => <ServicosEProdutos r={relatorio.data!} de={de} ate={ate} />}
              </Estado>
            ),
          },
          {
            id: 'canais',
            rotulo: 'Canais',
            conteudo: (
              <Estado consulta={relatorio}>
                {() => <Canais r={relatorio.data!} de={de} ate={ate} />}
              </Estado>
            ),
          },
          {
            id: 'agenda',
            rotulo: 'Agenda e avaliações',
            conteudo: <AgendaEAvaliacoes de={de} ate={ate} />,
          },
        ]}
      />
    </div>
  );
}

/** O mesmo relatório em arquivo, para guardar ou mandar ao sócio e ao contador. */
function Baixar({ mes, unidade }: { mes: string; unidade: string | null }) {
  const base = `/api/relatorio/mes/arquivo?mes=${mes}${unidade ? `&unidadeId=${unidade}` : ''}`;
  const classe =
    'inline-flex min-h-11 items-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-foco';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-tinta-suave">Baixar este relatório:</span>
      <a href={`${base}&formato=pdf`} className={classe} download>
        <FileText aria-hidden className="size-4" /> PDF
      </a>
      <a href={`${base}&formato=csv`} className={classe} download>
        <FileSpreadsheet aria-hidden className="size-4" /> Planilha (CSV)
      </a>
    </div>
  );
}

function VisaoGeral({ r }: { r: RelatorioDoMes }) {
  const linhas = compararMeses(r.atual, r.anterior);
  const frases = frasesDoMes(linhas);
  return (
    <>
      <section aria-labelledby="rel-numeros" className="flex flex-col gap-3">
        <h2 id="rel-numeros" className="text-lg font-semibold">
          O mês em números
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {r.projecao && (
            <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-modulo/50 bg-superficie p-3 sm:p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                Projeção do mês
              </span>
              <span className="font-denso text-2xl font-bold tabular-nums">
                {formatarMoeda(r.projecao.projecao)}
              </span>
              <span className="text-sm text-tinta-suave">
                Se o ritmo dos dias trabalhados seguir até o fim do mês
              </span>
            </div>
          )}
          {linhas.map((l) => (
            <div
              key={l.chave}
              className="flex min-w-0 flex-col gap-1 rounded-lg border border-borda bg-superficie p-3 sm:p-4"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
                {l.rotulo}
              </span>
              <span className="font-denso text-2xl font-bold tabular-nums">
                {formatar(l.atual, l.formato)}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 text-sm text-tinta-suave">
                <Variacao l={l} /> antes {formatar(l.anterior, l.formato)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Frases
          titulo="O que melhorou"
          itens={frases.melhorou}
          vazio="Nada subiu de forma relevante."
          tom="melhorou"
        />
        <Frases
          titulo="O que piorou"
          itens={frases.piorou}
          vazio="Nada piorou de forma relevante."
          tom="piorou"
        />
      </div>

      <Historico r={r} />
    </>
  );
}

function Frases({
  titulo,
  itens,
  vazio,
  tom,
}: {
  titulo: string;
  itens: string[];
  vazio: string;
  tom: 'melhorou' | 'piorou';
}) {
  const Icone = tom === 'melhorou' ? ArrowUp : ArrowDown;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-4">
      <h2 className="font-semibold">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-tinta-suave">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {itens.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Icone aria-hidden className={cn('mt-1 size-4 shrink-0', COR_TENDENCIA[tom])} />
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Faturamento dos últimos 12 meses: uma série só (sem legenda), dica com valor e lucro. */
function Historico({ r }: { r: RelatorioDoMes }) {
  const [foco, setFoco] = useState<number | null>(null);
  const maximo = Math.max(1, ...r.historico.map((h) => h.faturamento));
  const curto = (m: string) => nomeDoMes(m).slice(0, 3);
  const ativo = foco !== null ? r.historico[foco] : null;
  return (
    <section
      aria-labelledby="rel-historico"
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rel-historico" className="font-semibold">
          Faturamento dos últimos 12 meses
        </h2>
        <p className="min-h-6 text-sm text-tinta-suave" aria-live="polite">
          {ativo
            ? `${nomeDoMes(ativo.mes)}: ${formatarMoeda(ativo.faturamento)}${ativo.lucro !== null ? ` · lucro ${formatarMoeda(ativo.lucro)}` : ''}`
            : 'Toque ou passe o mouse numa barra'}
        </p>
      </div>
      <div
        className="flex h-44 items-end gap-[2px]"
        role="img"
        aria-label="Gráfico do faturamento dos últimos 12 meses (valores na tabela abaixo)"
      >
        {r.historico.map((h, i) => (
          <button
            key={h.mes}
            type="button"
            onMouseEnter={() => setFoco(i)}
            onMouseLeave={() => setFoco(null)}
            onFocus={() => setFoco(i)}
            onBlur={() => setFoco(null)}
            onClick={() => setFoco(i)}
            aria-label={`${nomeDoMes(h.mes)}: ${formatarMoeda(h.faturamento)}`}
            className="group flex h-full flex-1 flex-col justify-end"
          >
            <span
              className={cn(
                'block w-full rounded-t-[4px] transition-opacity',
                i === r.historico.length - 1 ? 'bg-modulo' : 'bg-acao',
                foco !== null && foco !== i && 'opacity-50',
              )}
              style={{ height: `${Math.max(2, (h.faturamento / maximo) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-[2px] text-center text-xs text-tinta-suave" aria-hidden>
        {r.historico.map((h) => (
          <span key={h.mes} className="flex-1 truncate capitalize">
            {curto(h.mes)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Faturamento e lucro por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Faturamento</th>
            <th scope="col">Lucro</th>
          </tr>
        </thead>
        <tbody>
          {r.historico.map((h) => (
            <tr key={h.mes}>
              <th scope="row">{nomeDoMes(h.mes)}</th>
              <td>{formatarMoeda(h.faturamento)}</td>
              <td>{h.lucro !== null ? formatarMoeda(h.lucro) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const ORDENS_BARBEIRO = {
  faturamento: { rotulo: 'Faturamento', valor: (b: BarbeiroDoMes) => b.faturamento },
  lucro: { rotulo: 'Lucro que gera', valor: (b: BarbeiroDoMes) => custoELucroDoBarbeiro(b).lucro },
  ticket: { rotulo: 'Ticket médio', valor: (b: BarbeiroDoMes) => b.ticketMedio },
  extras: { rotulo: 'Extras', valor: (b: BarbeiroDoMes) => b.percentualExtras },
  retorno: { rotulo: 'Clientes que voltam', valor: (b: BarbeiroDoMes) => b.taxaRetorno },
  ocupacao: { rotulo: 'Agenda ocupada', valor: (b: BarbeiroDoMes) => b.ocupacao },
  nota: { rotulo: 'Nota dos clientes', valor: (b: BarbeiroDoMes) => b.notaMedia ?? -1 },
} as const;
type OrdemBarbeiro = keyof typeof ORDENS_BARBEIRO;

/** Cada barbeiro no mês: quanto custa, quanto rende, como atende e onde melhorar. */
function Barbeiros({ r }: { r: RelatorioDoMes }) {
  const [ordem, setOrdem] = useState<OrdemBarbeiro>('faturamento');
  const lista = r.barbeiros
    .filter((b) => b.clientes > 0 || b.faturamentoAnterior > 0)
    .sort((a, b) => ORDENS_BARBEIRO[ordem].valor(b) - ORDENS_BARBEIRO[ordem].valor(a));
  if (lista.length === 0)
    return <p className="text-tinta-suave">Nenhum barbeiro atendeu neste mês.</p>;
  return (
    <section aria-labelledby="rel-barbeiros" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="rel-barbeiros" className="text-lg font-semibold">
          Quanto cada barbeiro custa e quanto rende
        </h2>
        {lista.length > 1 && (
          <Selecao
            id="barbeiros-ordem"
            rotulo="Ordenar por"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as OrdemBarbeiro)}
            opcoes={(Object.keys(ORDENS_BARBEIRO) as OrdemBarbeiro[])
              .filter((o) => o !== 'lucro' || r.verLucro)
              .map((o) => ({ valor: o, rotulo: ORDENS_BARBEIRO[o].rotulo }))}
            className="max-w-xs"
          />
        )}
      </div>
      <ul className="grid gap-3 lg:grid-cols-2">
        {lista.map((b) => {
          const { custo, lucro } = custoELucroDoBarbeiro(b);
          const pontos = pontosDoBarbeiro(b, r.barbeiros);
          const variacao =
            b.faturamentoAnterior > 0
              ? (b.faturamento - b.faturamentoAnterior) / b.faturamentoAnterior
              : null;
          return (
            <li
              key={b.profissionalId}
              className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  <Link
                    href={`/equipe/ficha?id=${b.profissionalId}&mes=${r.mes}&voltar=resultados`}
                    className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco"
                  >
                    {b.nome}
                  </Link>
                </h3>
                <span className="text-sm text-tinta-suave">
                  {formatarMoeda(b.faturamento)}
                  {variacao !== null && (
                    <span
                      className={cn(
                        'ml-2 font-semibold',
                        variacao >= 0 ? 'text-acao-texto' : 'text-perigo-texto',
                      )}
                    >
                      {variacao >= 0 ? '+' : ''}
                      {Math.round(variacao * 100)}%
                    </span>
                  )}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <Dado rotulo="Comissão" valor={formatarMoeda(b.comissao)} />
                <Dado rotulo="Valor fixo" valor={b.custoFixo ? formatarMoeda(b.custoFixo) : '—'} />
                <Dado rotulo="Custa no mês" valor={formatarMoeda(custo)} />
                {r.verLucro && (
                  <Dado
                    rotulo="Lucro que gera"
                    valor={formatarMoeda(lucro)}
                    destaque={lucro < 0 ? 'perigo' : 'acao'}
                  />
                )}
                <Dado rotulo="Atendimentos" valor={formatarNumero(b.atendimentos)} />
                <Dado rotulo="Ticket médio" valor={formatarMoeda(b.ticketMedio)} />
                <Dado rotulo="Extras" valor={formatarFracao(b.percentualExtras, 0)} />
                <Dado rotulo="Retorno" valor={formatarFracao(b.taxaRetorno, 0)} />
                <Dado
                  rotulo="Nota"
                  valor={
                    b.notaMedia !== null
                      ? b.notaMedia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                      : '—'
                  }
                />
                <Dado rotulo="Faltas" valor={formatarNumero(b.faltas)} />
                <Dado rotulo="Agenda ocupada" valor={formatarFracao(b.ocupacao, 0)} />
                <Dado rotulo="Confirmou no prazo" valor={formatarFracao(b.percentualNoPrazo, 0)} />
              </dl>
              {b.servicosMaisFeitos.length > 0 && (
                <p className="text-sm text-tinta-suave">
                  Mais faz:{' '}
                  {b.servicosMaisFeitos.map((s) => `${s.nome} (${s.quantidade})`).join(', ')}
                </p>
              )}
              {(pontos.fortes.length > 0 || pontos.fracos.length > 0) && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {pontos.fortes.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md border border-acao-texto/40 px-2 py-1 text-acao-texto"
                    >
                      <ArrowUp aria-hidden className="size-3.5" />
                      <span className="sr-only">Ponto forte: </span>
                      {t}
                    </span>
                  ))}
                  {pontos.fracos.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-md border border-perigo-texto/40 px-2 py-1 text-perigo-texto"
                    >
                      <ArrowDown aria-hidden className="size-3.5" />
                      <span className="sr-only">Ponto a melhorar: </span>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!r.barbeiros.some((b) => b.custoFixo > 0) && (
        <p className="text-sm text-tinta-suave">
          Algum barbeiro recebe salário ou ajuda de custo além da comissão? Cadastre em Equipe →
          &ldquo;Mudar valor fixo&rdquo; para o custo dele aparecer completo.
        </p>
      )}
    </section>
  );
}

function Dado({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: 'acao' | 'perigo';
}) {
  return (
    <div className="min-w-0">
      <dt className="text-tinta-suave">{rotulo}</dt>
      <dd
        className={cn(
          'font-denso text-lg font-semibold tabular-nums',
          destaque === 'acao' && 'text-acao-texto',
          destaque === 'perigo' && 'text-perigo-texto',
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

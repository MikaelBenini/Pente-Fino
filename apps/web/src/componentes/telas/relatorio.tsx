'use client';

// Relatório do mês (Etapa 23.1): o mês contra o anterior em números e em frases, os últimos 12
// meses, canais, barbeiros (custo, lucro, pontos fortes e fracos) e o mix de serviços e produtos.
import {
  compararMeses,
  custoELucroDoBarbeiro,
  formatarFracao,
  formatarMoeda,
  formatarNumero,
  frasesDoMes,
  mesAnteriorDe,
  mixDoMes,
  NOME_CANAL,
  CANAIS,
  pontosDoBarbeiro,
  type FormatoIndicador,
  type LinhaComparativo,
  type RelatorioDoMes,
} from '@pente-fino/shared';
import { cn } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { mesAtual, nomeDoMes } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado, Tabela, td, th } from '../pagina';

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

function textoVariacao(l: LinhaComparativo): string {
  if (l.atual === null || l.anterior === null) return 'sem dado';
  if (l.variacao === null) return 'novo';
  if (l.formato === 'fracao') {
    const p = Math.round(l.variacao * 100);
    return `${p > 0 ? '+' : ''}${p} p.p.`;
  }
  if (l.formato === 'nota')
    return `${l.variacao > 0 ? '+' : ''}${l.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
  const p = Math.round(l.variacao * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
}

const COR_TENDENCIA = {
  melhorou: 'text-acao-texto',
  piorou: 'text-perigo-texto',
  igual: 'text-tinta-suave',
} as const;
const NOME_TENDENCIA = { melhorou: 'melhorou', piorou: 'piorou', igual: 'estável' } as const;

function Variacao({ l }: { l: LinhaComparativo }) {
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
      {textoVariacao(l)}
      <span className="sr-only"> ({NOME_TENDENCIA[l.tendencia]})</span>
    </span>
  );
}

export function TelaRelatorio() {
  const { unidadeAtiva } = useApp();
  const [mes, setMes] = useState(mesAtual());
  const unidade = unidadeAtiva && unidadeAtiva !== 'todas' ? unidadeAtiva : null;
  const relatorio = useQuery({
    queryKey: ['relatorio', mes, unidade],
    queryFn: () =>
      api<RelatorioDoMes>(`relatorio/mes?mes=${mes}${unidade ? `&unidadeId=${unidade}` : ''}`),
  });
  const ehAtual = mes === mesAtual();

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Relatório do mês"
        pergunta={`${nomeDoMes(mes)} comparado com ${nomeDoMes(mesAnteriorDe(mes))}`}
        acao={
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMes(mesAnteriorDe(mes))}
              className="grid size-11 place-items-center rounded-md border border-borda hover:bg-superficie-2"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </button>
            <span className="min-w-36 text-center font-semibold">{maiuscula(nomeDoMes(mes))}</span>
            <button
              type="button"
              aria-label="Mês seguinte"
              disabled={ehAtual}
              onClick={() => setMes(proximoMes(mes))}
              className="grid size-11 place-items-center rounded-md border border-borda hover:bg-superficie-2 disabled:opacity-40"
            >
              <ChevronRight aria-hidden className="size-5" />
            </button>
          </div>
        }
      />
      <Estado consulta={relatorio}>
        {() => <Conteudo r={relatorio.data!} ehAtual={ehAtual} />}
      </Estado>
    </div>
  );
}

function Conteudo({ r, ehAtual }: { r: RelatorioDoMes; ehAtual: boolean }) {
  const linhas = compararMeses(r.atual, r.anterior);
  const frases = frasesDoMes(linhas);
  return (
    <>
      {ehAtual && (
        <p className="text-sm text-tinta-suave">
          O mês ainda não acabou: a comparação é com os mesmos dias do mês anterior (até o dia{' '}
          {Number(r.periodoAnterior.ate.slice(8, 10))}).
        </p>
      )}
      <section aria-labelledby="rel-numeros" className="flex flex-col gap-3">
        <h2 id="rel-numeros" className="text-lg font-semibold">
          O mês em números
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
      <Canais r={r} />
      <Barbeiros r={r} />
      <Mix r={r} />
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

function Canais({ r }: { r: RelatorioDoMes }) {
  const canais = CANAIS.filter(
    (c) => (r.atual.porCanal[c] ?? 0) + (r.anterior.porCanal[c] ?? 0) > 0,
  );
  if (canais.length === 0) return null;
  const total = canais.reduce((s, c) => s + (r.atual.porCanal[c] ?? 0), 0);
  return (
    <section aria-labelledby="rel-canais" className="flex flex-col gap-3">
      <h2 id="rel-canais" className="text-lg font-semibold">
        Por onde os clientes chegaram
      </h2>
      <Tabela rotulo="Atendimentos por canal">
        <thead>
          <tr className="border-b border-borda">
            {['Canal', 'Atendidos', 'Parte', 'Mês anterior'].map((c) => (
              <th key={c} scope="col" className={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {canais.map((c) => (
            <tr key={c} className="border-b border-borda">
              <th scope="row" className={`${td} font-semibold`}>
                {NOME_CANAL[c]}
              </th>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {formatarNumero(r.atual.porCanal[c] ?? 0)}
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {total > 0 ? formatarFracao((r.atual.porCanal[c] ?? 0) / total, 0) : '—'}
              </td>
              <td className={`${td} tabular-nums text-tinta-suave`}>
                {formatarNumero(r.anterior.porCanal[c] ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </section>
  );
}

function Barbeiros({ r }: { r: RelatorioDoMes }) {
  const lista = r.barbeiros.filter((b) => b.clientes > 0 || b.faturamentoAnterior > 0);
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="rel-barbeiros" className="flex flex-col gap-3">
      <h2 id="rel-barbeiros" className="text-lg font-semibold">
        Barbeiros: quanto custam e quanto rendem
      </h2>
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
                <h3 className="text-lg font-semibold">{b.nome}</h3>
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

function Mix({ r }: { r: RelatorioDoMes }) {
  const linhas = mixDoMes(r.mixAtual, r.mixAnterior);
  if (linhas.length === 0) return null;
  const colunas = [
    'Item',
    'Quantidade',
    '% da quantidade',
    'Receita',
    '% da receita',
    'vs. mês anterior',
  ];
  if (r.verLucro) colunas.push('Lucro');
  return (
    <section aria-labelledby="rel-mix" className="flex flex-col gap-3">
      <h2 id="rel-mix" className="text-lg font-semibold">
        Serviços e produtos: quanto cada um pesa
      </h2>
      <Tabela rotulo="Participação de cada serviço e produto">
        <thead>
          <tr className="border-b border-borda">
            {colunas.map((c) => (
              <th key={c} scope="col" className={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={`${l.tipo}-${l.id}`} className="border-b border-borda">
              <th scope="row" className={`${td} font-semibold`}>
                {l.nome}
                <span className="ml-2 text-xs font-normal uppercase text-tinta-suave">
                  {l.tipo === 'servico' ? 'serviço' : 'produto'}
                </span>
              </th>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {formatarNumero(l.quantidade)}
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {formatarFracao(l.fatiaQuantidade, 0)}
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{formatarMoeda(l.receita)}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {formatarFracao(l.fatiaReceita, 0)}
              </td>
              <td
                className={cn(
                  `${td} tabular-nums`,
                  l.variacaoReceita === null
                    ? 'text-tinta-suave'
                    : l.variacaoReceita >= 0
                      ? 'text-acao-texto'
                      : 'text-perigo-texto',
                )}
              >
                {l.variacaoReceita === null
                  ? 'novo'
                  : `${l.variacaoReceita >= 0 ? '+' : ''}${Math.round(l.variacaoReceita * 100)}%`}
              </td>
              {r.verLucro && (
                <td className={cn(`${td} tabular-nums`, (l.lucro ?? 0) < 0 && 'text-perigo-texto')}>
                  {l.lucro !== null ? formatarMoeda(l.lucro) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Tabela>
    </section>
  );
}

'use client';

import {
  dataLocal,
  formatarDiaPorExtenso,
  formatarFracao,
  formatarHora,
  formatarMoeda,
  formatarNumero,
  NOME_SITUACAO_DIA,
  type ItemDoDia,
  type ProfissionalDoDia,
  type ResumoDoDia,
  type SituacaoDia,
} from '@pente-fino/shared';
import {
  Abas,
  Botao,
  CartaoIndicador,
  cn,
  EstadoVazio,
  EtiquetaEstado,
  Selecao,
} from '@pente-fino/ui';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cake,
  Clock,
  Sparkles,
  TriangleAlert,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useProfissionais, useResumoDia, useResumoMes } from '@/lib/consultas';
import { mesAtual, nomeDoMes } from '@/lib/periodo';
import { useApp } from '../contexto-app';
import { SeletorMes } from '../indicadores';
import { CabecalhoPagina, Estado, Ficha, Tabela, td, th } from '../pagina';

const somarDias = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const diaLongo = (d: string) => formatarDiaPorExtenso(`${d}T12:00:00-03:00`);

type FiltroSituacao = 'tudo' | SituacaoDia | 'faltas';
const FILTROS: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'a_atender', rotulo: 'A atender' },
  { valor: 'em_atendimento', rotulo: 'Em atendimento' },
  { valor: 'aguardando_fechamento', rotulo: 'Aguardando fechamento' },
  { valor: 'fechada', rotulo: 'Fechadas' },
  { valor: 'faltas', rotulo: 'Faltas e cancelados' },
];
const passa = (i: ItemDoDia, f: FiltroSituacao) =>
  f === 'tudo' ||
  (f === 'faltas' ? i.situacao === 'faltou' || i.situacao === 'cancelada' : i.situacao === f);

/** Barbeiros da unidade ativa, para o filtro. */
function useOpcoesBarbeiro() {
  const { unidadeAtiva } = useApp();
  const profissionais = useProfissionais();
  return [
    { valor: '', rotulo: 'Todos' },
    ...(profissionais.data ?? [])
      .filter((p) => p.ativo && (unidadeAtiva === 'todas' || p.unidadeId === unidadeAtiva))
      .map((p) => ({ valor: p.id, rotulo: p.nome })),
  ];
}

export function TelaResumoDia() {
  const [aba, setAba] = useState('dia');
  const [dia, setDia] = useState(() => dataLocal(new Date()));
  const [barbeiro, setBarbeiro] = useState('');
  const abrirDia = (d: string) => {
    setDia(d);
    setAba('dia');
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="flex flex-col gap-8">
      <CabecalhoPagina
        titulo="Resumo do dia"
        pergunta="O que tem para hoje e o que já foi feito?"
      />
      <Abas
        rotulo="Resumo"
        atual={aba}
        onTrocar={setAba}
        abas={[
          {
            id: 'dia',
            rotulo: 'Dia',
            conteudo: <Dia dia={dia} onDia={setDia} barbeiro={barbeiro} onBarbeiro={setBarbeiro} />,
          },
          {
            id: 'mes',
            rotulo: 'Mês dia a dia',
            conteudo: <Mes barbeiro={barbeiro} onBarbeiro={setBarbeiro} onAbrirDia={abrirDia} />,
          },
        ]}
      />
    </div>
  );
}

// ─── Dia ──────────────────────────────────────────────────────────────────

function Dia({
  dia,
  onDia,
  barbeiro,
  onBarbeiro,
}: {
  dia: string;
  onDia: (d: string) => void;
  barbeiro: string;
  onBarbeiro: (id: string) => void;
}) {
  const { unidadeAtiva } = useApp();
  const opcoes = useOpcoesBarbeiro();
  const [filtro, setFiltro] = useState<FiltroSituacao>('tudo');
  const resumo = useResumoDia(unidadeAtiva, dia, barbeiro || null);
  const hoje = dataLocal(new Date());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <Botao
            variante="secundario"
            className="px-3"
            aria-label="Dia anterior"
            onClick={() => onDia(somarDias(dia, -1))}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Botao>
          <p
            className="min-w-52 text-center text-lg font-semibold first-letter:uppercase"
            aria-live="polite"
          >
            {dia === hoje ? `Hoje, ${diaLongo(dia).split(', ')[1] ?? ''}` : diaLongo(dia)}
          </p>
          <Botao
            variante="secundario"
            className="px-3"
            aria-label="Dia seguinte"
            onClick={() => onDia(somarDias(dia, 1))}
          >
            <ChevronRight aria-hidden className="size-5" />
          </Botao>
          {dia !== hoje && (
            <Botao variante="fantasma" onClick={() => onDia(hoje)}>
              Hoje
            </Botao>
          )}
        </div>
        <Selecao
          id="dia-barbeiro"
          rotulo="Barbeiro"
          value={barbeiro}
          onChange={(e) => onBarbeiro(e.target.value)}
          opcoes={opcoes}
          className="min-w-48"
        />
        <Selecao
          id="dia-situacao"
          rotulo="Mostrar"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as FiltroSituacao)}
          opcoes={FILTROS}
          className="min-w-48"
        />
      </div>
      <Estado consulta={resumo}>
        {() => <ConteudoDia r={resumo.data!} filtro={filtro} passado={dia < hoje} />}
      </Estado>
    </div>
  );
}

function ConteudoDia({
  r,
  filtro,
  passado,
}: {
  r: ResumoDoDia;
  filtro: FiltroSituacao;
  passado: boolean;
}) {
  const t = r.totais;
  const atencao: { icone: typeof Clock; texto: string; tom: 'aviso' | 'neutro' | 'perigo' }[] = [];
  if (t.pendentes)
    atencao.push({
      icone: TriangleAlert,
      tom: 'aviso',
      texto: `${t.pendentes} ${t.pendentes === 1 ? 'comanda esperando' : 'comandas esperando'} o barbeiro confirmar`,
    });
  if (t.aguardandoFechamento - t.pendentes > 0)
    atencao.push({
      icone: Clock,
      tom: 'neutro',
      texto: `${t.aguardandoFechamento - t.pendentes} pronta(s) para a recepção fechar`,
    });
  if (t.faltas)
    atencao.push({
      icone: UserX,
      tom: 'perigo',
      texto: `${t.faltas} ${t.faltas === 1 ? 'falta' : 'faltas'}`,
    });
  if (t.primeiraVez)
    atencao.push({
      icone: Sparkles,
      tom: 'neutro',
      texto: `${t.primeiraVez} ${t.primeiraVez === 1 ? 'cliente vem' : 'clientes vêm'} pela primeira vez`,
    });
  if (t.aniversariantes)
    atencao.push({
      icone: Cake,
      tom: 'neutro',
      texto: `${t.aniversariantes} ${t.aniversariantes === 1 ? 'aniversariante' : 'aniversariantes'} na agenda`,
    });

  return (
    <>
      <div className="animar-escalonado grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador
          rotulo="Atendidos"
          valor={`${formatarNumero(t.fechadas)} de ${formatarNumero(t.marcados)}`}
          origem={`Fechados de marcados no dia. Faltam ${t.aAtender} a atender e ${t.emAtendimento} em atendimento.`}
        />
        <CartaoIndicador
          rotulo="Faturamento"
          valor={formatarMoeda(t.faturamento)}
          origem={`Comandas fechadas no dia · ${t.clientes} clientes · ticket ${formatarMoeda(t.ticketMedio)}.`}
        />
        <CartaoIndicador
          rotulo={passado ? 'Ficou em aberto' : 'Ainda vai entrar'}
          valor={formatarMoeda(t.valorEmAberto)}
          origem="Comandas a atender, em atendimento e aguardando fechamento, pelo valor previsto."
        />
        <CartaoIndicador
          rotulo="Ocupação"
          valor={formatarFracao(t.ocupacao.fracao, 0)}
          origem={`${Math.round(t.ocupacao.agendadoMin / 60)} h marcadas de ${Math.round(t.ocupacao.disponivelMin / 60)} h de expediente.`}
        />
      </div>

      {atencao.length > 0 && (
        <section aria-labelledby="dia-atencao" className="flex flex-col gap-2">
          <h2 id="dia-atencao" className="text-lg font-semibold">
            Fique de olho
          </h2>
          <ul className="flex flex-wrap gap-2">
            {atencao.map((a) => (
              <li
                key={a.texto}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-md border px-3',
                  a.tom === 'aviso' && 'border-aviso-texto/50 text-aviso-texto',
                  a.tom === 'perigo' && 'border-perigo-texto/50 text-perigo-texto',
                  a.tom === 'neutro' && 'border-borda-forte text-tinta',
                )}
              >
                <a.icone aria-hidden className="size-5 shrink-0" />
                {a.texto}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.profissionais.length === 0 ? (
        <EstadoVazio
          icone={CalendarClock}
          titulo="Ninguém na agenda neste dia"
          texto="Cadastre os profissionais e os horários deles em Equipe."
        />
      ) : (
        <div className="animar-escalonado grid gap-4 xl:grid-cols-2">
          {r.profissionais.map((p) => (
            <CartaoProfissional key={p.profissionalId} p={p} filtro={filtro} />
          ))}
        </div>
      )}
    </>
  );
}

function CartaoProfissional({ p, filtro }: { p: ProfissionalDoDia; filtro: FiltroSituacao }) {
  const itens = p.itens.filter((i) => passa(i, filtro));
  const c = p.contagem;
  return (
    <section
      aria-labelledby={`dia-prof-${p.profissionalId}`}
      className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`dia-prof-${p.profissionalId}`} className="truncate text-xl font-semibold">
            {p.nome}
          </h2>
          <p className="text-sm text-tinta-suave tabular-nums">
            {c.fechadas} de {c.marcados} atendidos · {formatarMoeda(p.faturamento)} · ocupação{' '}
            {formatarFracao(p.ocupacao.fracao, 0)}
            {c.pendentes > 0 && (
              <span className="text-aviso-texto"> · {c.pendentes} sem confirmar</span>
            )}
          </p>
        </div>
        <Link
          href={`/equipe/ficha?id=${p.profissionalId}`}
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-tinta-suave hover:text-tinta"
        >
          Ver ficha
        </Link>
      </div>
      {p.proximo && (
        <p className="flex flex-wrap items-center gap-2 rounded-md bg-superficie-2 px-3 py-2">
          <Clock aria-hidden className="size-5 text-modulo-texto" />
          <span className="font-semibold">Próximo: {formatarHora(p.proximo.inicio)}</span>
          <span>
            {p.proximo.cliente ?? 'Cliente sem cadastro'}
            {p.proximo.servicos.length > 0 && (
              <span className="text-tinta-suave"> · {p.proximo.servicos.join(', ')}</span>
            )}
          </span>
        </p>
      )}
      {itens.length === 0 ? (
        <p className="text-tinta-suave">
          {p.itens.length === 0 ? 'Agenda livre neste dia.' : 'Nada neste filtro.'}
        </p>
      ) : (
        <ul className="divide-y divide-borda" aria-label={`Agenda de ${p.nome}`}>
          {itens.map((i) => (
            <LinhaDoDia key={i.comandaId ?? i.agendamentoId} i={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaDoDia({ i }: { i: ItemDoDia }) {
  const conteudo: ReactNode = (
    <>
      <span className="w-14 shrink-0 font-denso text-lg font-semibold tabular-nums">
        {formatarHora(i.inicio)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{i.cliente ?? 'Cliente sem cadastro'}</span>
          {i.primeiraVez && i.cliente && <Ficha tom="acao">1ª vez</Ficha>}
          {i.aniversario && (
            <span className="inline-flex items-center gap-1 text-sm text-modulo-texto">
              <Cake aria-hidden className="size-4" /> Aniversário
            </span>
          )}
        </span>
        <span className="block text-sm text-tinta-suave">
          {i.servicos.join(', ') || 'Sem serviço lançado'}
          {i.origem === 'sem_agendamento' && ' · chegou sem horário'}
          {i.origem === 'link' && ' · marcou pelo link'}
          {i.origem === 'bot' && ' · marcou pelo WhatsApp'}
        </span>
        {i.observacao && <span className="block text-sm text-tinta-suave">“{i.observacao}”</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="tabular-nums">{formatarMoeda(i.valor)}</span>
        {i.situacao === 'faltou' ? (
          <Ficha tom="perigo">Faltou</Ficha>
        ) : (
          <EtiquetaEstado estado={i.status} />
        )}
      </span>
    </>
  );
  return (
    <li>
      {i.comandaId ? (
        <Link
          href={`/comandas?id=${i.comandaId}`}
          aria-label={`${formatarHora(i.inicio)}, ${i.cliente ?? 'cliente'}: ${NOME_SITUACAO_DIA[i.situacao]}`}
          className="flex items-start gap-3 py-3 hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
        >
          {conteudo}
        </Link>
      ) : (
        <div className="flex items-start gap-3 py-3">{conteudo}</div>
      )}
    </li>
  );
}

// ─── Mês dia a dia ────────────────────────────────────────────────────────

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function Mes({
  barbeiro,
  onBarbeiro,
  onAbrirDia,
}: {
  barbeiro: string;
  onBarbeiro: (id: string) => void;
  onAbrirDia: (d: string) => void;
}) {
  const { unidadeAtiva } = useApp();
  const opcoes = useOpcoesBarbeiro();
  const [mes, setMes] = useState(mesAtual());
  const [soTrabalho, setSoTrabalho] = useState(true);
  const resumo = useResumoMes(unidadeAtiva, mes, barbeiro || null);
  const hoje = dataLocal(new Date());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <SeletorMes mes={mes} onMudar={setMes} />
        <Selecao
          id="mes-barbeiro"
          rotulo="Barbeiro"
          value={barbeiro}
          onChange={(e) => onBarbeiro(e.target.value)}
          opcoes={opcoes}
          className="min-w-48"
        />
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={soTrabalho}
            onChange={(e) => setSoTrabalho(e.target.checked)}
            className="size-5 accent-[var(--modulo)]"
          />
          Só dias de trabalho
        </label>
      </div>
      <Estado consulta={resumo}>
        {() => {
          const r = resumo.data!;
          const t = r.totais;
          const maximo = Math.max(...r.dias.map((d) => d.faturamento), 1);
          const dias = r.dias.filter((d) => !soTrabalho || d.trabalha || d.faturamento > 0);
          return (
            <>
              <div className="animar-escalonado grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CartaoIndicador
                  rotulo="Faturamento"
                  valor={formatarMoeda(t.faturamento)}
                  origem={`${t.diasTrabalhados} dias trabalhados até hoje em ${nomeDoMes(mes)}.`}
                />
                <CartaoIndicador
                  rotulo="Clientes"
                  valor={formatarNumero(t.clientes)}
                  origem={`Ticket médio ${formatarMoeda(t.ticketMedio)}.`}
                />
                <CartaoIndicador
                  rotulo="Agendados"
                  valor={formatarNumero(t.agendados)}
                  origem={`${t.cancelados} cancelados fora da conta.`}
                />
                <CartaoIndicador
                  rotulo="Faltas"
                  valor={formatarNumero(t.faltas)}
                  origem={
                    t.agendados
                      ? `${formatarFracao(t.faltas / t.agendados, 0)} dos agendados não vieram.`
                      : 'Nenhum agendamento no mês.'
                  }
                />
              </div>
              <Tabela rotulo={`${nomeDoMes(mes)} dia a dia`}>
                <thead>
                  <tr>
                    <th className={th}>Dia</th>
                    <th className={`${th} text-right`}>Agendados</th>
                    <th className={`${th} text-right`}>Faltas</th>
                    <th className={`${th} text-right`}>Clientes</th>
                    <th className={`${th} min-w-40 text-right`}>Faturamento</th>
                    <th className={`${th} text-right`}>Ticket</th>
                    <th className={`${th} text-right`}>Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda tabular-nums">
                  {dias.map((d) => (
                    <tr
                      key={d.data}
                      className={cn(
                        !d.trabalha && 'text-tinta-fraca',
                        d.data === hoje && 'bg-superficie-2',
                      )}
                    >
                      <th scope="row" className={`${td} text-left font-medium whitespace-nowrap`}>
                        <button
                          type="button"
                          onClick={() => onAbrirDia(d.data)}
                          aria-label={`Abrir ${diaLongo(d.data)}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-md underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-foco"
                        >
                          <span className="w-8 text-tinta-suave">
                            {SEMANA[new Date(`${d.data}T12:00:00Z`).getUTCDay()]}
                          </span>
                          {d.data.slice(8)}
                          {!d.trabalha && <span className="text-sm font-normal">fechado</span>}
                        </button>
                      </th>
                      <td className={`${td} text-right`}>{d.agendados || '—'}</td>
                      <td className={cn(td, 'text-right', d.faltas > 0 && 'text-perigo-texto')}>
                        {d.faltas || '—'}
                      </td>
                      <td className={`${td} text-right`}>{d.clientes || '—'}</td>
                      <td className={`${td} text-right`}>
                        {d.faturamento ? formatarMoeda(d.faturamento) : '—'}
                        <span aria-hidden className="mt-1 ml-auto block h-1.5 w-full max-w-32">
                          <span
                            className="animar-barra-x block h-full rounded-r-[4px] bg-modulo-texto/70"
                            style={{ width: `${(d.faturamento / maximo) * 100}%` }}
                          />
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        {d.clientes ? formatarMoeda(d.ticketMedio) : '—'}
                      </td>
                      <td className={`${td} text-right`}>
                        {d.comissao ? formatarMoeda(d.comissao) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <p className="flex items-center gap-2 text-sm text-tinta-suave">
                <ClipboardList aria-hidden className="size-4" />
                Toque no dia para ver a agenda e o que cada barbeiro fez.
              </p>
            </>
          );
        }}
      </Estado>
    </div>
  );
}

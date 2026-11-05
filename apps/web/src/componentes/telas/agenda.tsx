'use client';

import {
  dataLocal,
  formatarDiaPorExtenso,
  formatarHora,
  formatarMoeda,
  NOMES_DIAS_CURTOS,
  type Agenda,
  type AgendaItem,
  type ComandaDetalhe,
} from '@pente-fino/shared';
import {
  BlocoAgenda,
  Botao,
  Campo,
  Dialogo,
  EstadoVazio,
  Marcador,
  Selecao,
  cn,
} from '@pente-fino/ui';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  INVALIDAR_OPERACAO,
  useAcao,
  useAgenda,
  useLivres,
  usePrecos,
  useServicos,
} from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { CabecalhoPagina, Estado } from '../pagina';
import { useUnidadeTrabalho } from '../unidade-trabalho';
import { BuscaCliente, clienteParaApi, type ClienteEscolhido } from './busca-cliente';

const PX_POR_MIN = 1.4;

function somarDias(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const diaSemana = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
const minutosDoDia = (iso: string) => {
  const [h, m] = formatarHora(iso).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const hora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

type Visao = 'dia' | 'semana' | 'mes';

function periodo(visao: Visao, dia: string): [string, string] {
  if (visao === 'dia') return [dia, dia];
  if (visao === 'semana') {
    const inicio = somarDias(dia, -diaSemana(dia));
    return [inicio, somarDias(inicio, 6)];
  }
  const inicio = `${dia.slice(0, 8)}01`;
  const fim = somarDias(`${somarDias(inicio, 32).slice(0, 8)}01`, -1);
  return [inicio, fim];
}

export function TelaAgenda() {
  const { papeis } = useApp();
  const { unidadeId, seletor } = useUnidadeTrabalho();
  const [dia, setDia] = useState(dataLocal(new Date()));
  const [visao, setVisao] = useState<Visao>('dia');
  const [de, ate] = periodo(visao, dia);
  const agenda = useAgenda(unidadeId, de, ate);
  const [novo, setNovo] = useState(false);
  const balcao = papeis.some((p) => p !== 'barbeiro');
  const passo = visao === 'dia' ? 1 : visao === 'semana' ? 7 : 31;
  const titulo =
    visao === 'mes'
      ? new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : visao === 'semana'
        ? `Semana de ${formatarDiaPorExtenso(`${de}T12:00:00Z`)}`
        : formatarDiaPorExtenso(`${dia}T12:00:00Z`);

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Agenda"
        pergunta="Quem atende quem e quando?"
        acao={
          balcao &&
          unidadeId && (
            <Botao onClick={() => setNovo(true)}>
              <Plus aria-hidden className="size-5" /> Novo agendamento
            </Botao>
          )
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {seletor}
          <div className="flex items-center gap-1">
            <Botao
              variante="secundario"
              className="px-3"
              aria-label="Anterior"
              onClick={() =>
                setDia(
                  visao === 'mes'
                    ? `${somarDias(`${dia.slice(0, 8)}01`, -1).slice(0, 8)}01`
                    : somarDias(dia, -passo),
                )
              }
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Botao>
            <Botao variante="secundario" onClick={() => setDia(dataLocal(new Date()))}>
              Hoje
            </Botao>
            <Botao
              variante="secundario"
              className="px-3"
              aria-label="Próximo"
              onClick={() =>
                setDia(
                  visao === 'mes'
                    ? somarDias(`${dia.slice(0, 8)}01`, 32).slice(0, 8) + '01'
                    : somarDias(dia, passo),
                )
              }
            >
              <ChevronRight aria-hidden className="size-5" />
            </Botao>
          </div>
          <p className="min-h-11 content-center text-lg font-semibold first-letter:uppercase">
            {titulo}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Visão"
          className="inline-flex rounded-md border border-borda bg-superficie p-1"
        >
          {(['dia', 'semana', 'mes'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visao === v}
              onClick={() => setVisao(v)}
              className={cn(
                'min-h-10 rounded-sm px-4 font-semibold capitalize focus-visible:outline-2 focus-visible:outline-foco',
                visao === v ? 'bg-modulo text-sobre-modulo' : 'text-tinta-suave hover:text-tinta',
              )}
            >
              {v === 'mes' ? 'Mês' : v}
            </button>
          ))}
        </div>
      </div>
      <Estado consulta={agenda}>
        {() =>
          agenda.data!.profissionais.length === 0 ? (
            <EstadoVazio
              icone={CalendarDays}
              titulo="Nenhum profissional nesta unidade"
              texto="Cadastre a equipe em Equipe. Depois, os horários de cada um aparecem aqui."
            />
          ) : visao === 'dia' ? (
            <VisaoDia agenda={agenda.data!} dia={dia} />
          ) : visao === 'semana' ? (
            <VisaoSemana
              agenda={agenda.data!}
              inicio={de}
              onDia={(d) => {
                setDia(d);
                setVisao('dia');
              }}
            />
          ) : (
            <VisaoMes
              agenda={agenda.data!}
              inicio={de}
              fim={ate}
              onDia={(d) => {
                setDia(d);
                setVisao('dia');
              }}
            />
          )
        }
      </Estado>
      {unidadeId && (
        <NovoAgendamento
          unidadeId={unidadeId}
          diaInicial={dia}
          agenda={agenda.data}
          aberto={novo}
          onFechar={() => setNovo(false)}
        />
      )}
    </div>
  );
}

function abrirComanda(router: ReturnType<typeof useRouter>, item: AgendaItem) {
  if (item.comandaId) router.push(`/comandas?id=${item.comandaId}`);
}

function VisaoDia({ agenda, dia }: { agenda: Agenda; dia: string }) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const ds = diaSemana(dia);
  const fechado = agenda.fechados.includes(dia) || !agenda.diasTrabalho.includes(ds);
  const turnos = agenda.profissionais.flatMap((p) => p.horarios.filter((h) => h.diaSemana === ds));
  const doDia = agenda.itens.filter((i) => dataLocal(new Date(i.inicio)) === dia);
  const bloqueiosDia = agenda.bloqueios.filter((b) => dataLocal(new Date(b.inicio)) === dia);
  const minimo = Math.min(
    540,
    ...turnos.map((t) => t.inicioMin),
    ...doDia.map((i) => minutosDoDia(i.inicio)),
  );
  const maximo = Math.max(
    1140,
    ...turnos.map((t) => t.fimMin),
    ...doDia.map((i) => minutosDoDia(i.fim)),
  );
  const inicioGrade = Math.floor(minimo / 60) * 60;
  const altura = (maximo - inicioGrade) * PX_POR_MIN;
  const profissionalCelular = escolhido ?? agenda.profissionais[0]!.id;

  if (fechado && doDia.length === 0) {
    return (
      <EstadoVazio
        icone={CalendarDays}
        titulo="Unidade fechada neste dia"
        texto="Folga, feriado ou dia sem expediente. Escolha outro dia."
      />
    );
  }

  const coluna = (p: Agenda['profissionais'][number]) => (
    <div key={p.id} className="relative min-w-0 border-l border-borda" style={{ height: altura }}>
      {p.horarios
        .filter((h) => h.diaSemana === ds)
        .map((h, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-x-0 bg-superficie"
            style={{
              top: (h.inicioMin - inicioGrade) * PX_POR_MIN,
              height: (h.fimMin - h.inicioMin) * PX_POR_MIN,
            }}
          />
        ))}
      {bloqueiosDia
        .filter((b) => b.profissionalId === p.id)
        .map((b) => (
          <div
            key={b.id}
            className="absolute inset-x-1 rounded-md border border-dashed border-borda-forte bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--superficie-3)_6px_8px)] px-2 py-1 text-xs text-tinta-suave"
            style={{
              top: (minutosDoDia(b.inicio) - inicioGrade) * PX_POR_MIN,
              height: Math.max(24, (minutosDoDia(b.fim) - minutosDoDia(b.inicio)) * PX_POR_MIN),
            }}
          >
            {b.motivo ?? 'Bloqueado'}
          </div>
        ))}
      {doDia
        .filter((i) => i.profissionalId === p.id)
        .map((i) => (
          <div
            key={i.agendamentoId}
            className="absolute inset-x-1"
            style={{ top: (minutosDoDia(i.inicio) - inicioGrade) * PX_POR_MIN }}
          >
            <BlocoAgenda
              inicio={formatarHora(i.inicio)}
              fim={formatarHora(i.fim)}
              cliente={i.cliente}
              servico={i.servicos.join(' + ')}
              estado={i.status}
              confirmado={i.confirmado}
              altura={Math.max(48, (minutosDoDia(i.fim) - minutosDoDia(i.inicio)) * PX_POR_MIN - 2)}
              onClick={() => abrirComanda(router, i)}
            />
          </div>
        ))}
    </div>
  );

  const horas = Array.from(
    { length: Math.ceil((maximo - inicioGrade) / 60) + 1 },
    (_, i) => inicioGrade + i * 60,
  );
  const regua = (
    <div className="relative" style={{ height: altura }} aria-hidden>
      {horas.map((h) => (
        <span
          key={h}
          className="absolute right-2 -translate-y-1/2 font-denso text-sm tabular-nums text-tinta-fraca"
          style={{ top: (h - inicioGrade) * PX_POR_MIN }}
        >
          {hora(h)}
        </span>
      ))}
    </div>
  );

  return (
    <>
      {/* Celular e tablet: um profissional por vez, para caber na tela. */}
      <div className="flex flex-col gap-3 md:hidden">
        <Selecao
          id="agenda-profissional"
          rotulo="Profissional"
          value={profissionalCelular}
          onChange={(e) => setEscolhido(e.target.value)}
          opcoes={agenda.profissionais.map((p) => ({ valor: p.id, rotulo: p.nome }))}
        />
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-borda bg-fundo">
          {regua}
          {coluna(agenda.profissionais.find((p) => p.id === profissionalCelular)!)}
        </div>
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-borda bg-fundo md:block">
        <div
          className="grid min-w-fit"
          style={{
            gridTemplateColumns: `3.5rem repeat(${agenda.profissionais.length}, minmax(11rem, 1fr))`,
          }}
        >
          <div className="sticky top-0 border-b border-borda bg-superficie-2" />
          {agenda.profissionais.map((p) => (
            <div
              key={p.id}
              className="truncate border-b border-l border-borda bg-superficie-2 px-3 py-2 font-semibold"
            >
              {p.nome}
            </div>
          ))}
          {regua}
          {agenda.profissionais.map(coluna)}
        </div>
      </div>
    </>
  );
}

function VisaoSemana({
  agenda,
  inicio,
  onDia,
}: {
  agenda: Agenda;
  inicio: string;
  onDia: (d: string) => void;
}) {
  const router = useRouter();
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {dias.map((d) => {
        const itens = agenda.itens.filter((i) => dataLocal(new Date(i.inicio)) === d);
        const fechado = agenda.fechados.includes(d) || !agenda.diasTrabalho.includes(diaSemana(d));
        return (
          <section
            key={d}
            className="flex min-w-0 flex-col gap-2"
            aria-label={formatarDiaPorExtenso(`${d}T12:00:00Z`)}
          >
            <button
              type="button"
              onClick={() => onDia(d)}
              className="flex min-h-11 items-baseline justify-between rounded-md px-2 text-left hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
            >
              <span className="font-semibold">
                {NOMES_DIAS_CURTOS[diaSemana(d)]} {Number(d.slice(8))}
              </span>
              <span className="font-denso text-sm tabular-nums text-tinta-suave">
                {fechado ? 'fechado' : `${itens.length}`}
              </span>
            </button>
            {itens.map((i) => (
              <BlocoAgenda
                key={i.agendamentoId}
                inicio={formatarHora(i.inicio)}
                fim={formatarHora(i.fim)}
                cliente={i.cliente}
                servico={i.servicos.join(' + ')}
                estado={i.status}
                confirmado={i.confirmado}
                onClick={() => abrirComanda(router, i)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function VisaoMes({
  agenda,
  inicio,
  fim,
  onDia,
}: {
  agenda: Agenda;
  inicio: string;
  fim: string;
  onDia: (d: string) => void;
}) {
  const vazios = diaSemana(inicio);
  const total = Number(fim.slice(8));
  const hoje = dataLocal(new Date());
  return (
    <div className="grid grid-cols-7 gap-1">
      {NOMES_DIAS_CURTOS.map((d) => (
        <span
          key={d}
          className="py-1 text-center text-xs font-semibold uppercase tracking-wider text-tinta-suave"
        >
          {d}
        </span>
      ))}
      {Array.from({ length: vazios }, (_, i) => (
        <span key={`v${i}`} />
      ))}
      {Array.from({ length: total }, (_, i) => {
        const d = somarDias(inicio, i);
        const n = agenda.itens.filter(
          (x) => dataLocal(new Date(x.inicio)) === d && x.status !== 'cancelada',
        ).length;
        const fechado = agenda.fechados.includes(d) || !agenda.diasTrabalho.includes(diaSemana(d));
        return (
          <button
            key={d}
            type="button"
            onClick={() => onDia(d)}
            aria-label={`${formatarDiaPorExtenso(`${d}T12:00:00Z`)}: ${fechado ? 'fechado' : `${n} horários`}`}
            className={cn(
              'flex aspect-square min-h-11 flex-col items-start justify-between rounded-md border p-1.5 text-left hover:border-borda-forte focus-visible:outline-2 focus-visible:outline-foco sm:p-2',
              d === hoje ? 'border-modulo' : 'border-borda',
              fechado ? 'bg-fundo text-tinta-fraca' : 'bg-superficie',
            )}
          >
            <span className="font-denso text-sm font-semibold tabular-nums">{i + 1}</span>
            {!fechado && n > 0 && (
              <span className="font-denso text-lg font-bold tabular-nums text-modulo-texto sm:text-2xl">
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NovoAgendamento({
  unidadeId,
  diaInicial,
  agenda,
  aberto,
  onFechar,
}: {
  unidadeId: string;
  diaInicial: string;
  agenda?: Agenda;
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();
  const servicos = useServicos();
  const precos = usePrecos();
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [dia, setDia] = useState(diaInicial);
  const [profissionalId, setProfissionalId] = useState('');
  const [horario, setHorario] = useState<{ profissionalId: string; inicio: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const duracao = escolhidos.reduce(
    (s, id) => s + (servicos.data?.find((x) => x.id === id)?.duracaoMin ?? 0),
    0,
  );
  const livres = useLivres(aberto ? unidadeId : null, dia, duracao, profissionalId || undefined);
  const agendar = useAcao(
    (corpo: object) => api<ComandaDetalhe>('agendamentos', { corpo }),
    INVALIDAR_OPERACAO,
  );
  const total = escolhidos.reduce(
    (s, id) =>
      s +
      (precos.data?.vigentes.find((p) => p.servicoId === id && p.unidadeId === unidadeId)?.valor ??
        0),
    0,
  );
  const nomeProf = useMemo(
    () => new Map((agenda?.profissionais ?? []).map((p) => [p.id, p.nome])),
    [agenda],
  );

  function fechar() {
    setCliente(null);
    setEscolhidos([]);
    setHorario(null);
    setErro(null);
    onFechar();
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo="Novo agendamento"
      descricao="Já cria a comanda prevista com os serviços escolhidos."
      onFechar={fechar}
      largura="larga"
    >
      <form
        method="post"
        noValidate
        className="flex flex-col gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (!cliente) return setErro('Escolha o cliente.');
          if (!horario) return setErro('Escolha um horário livre.');
          try {
            const r = await agendar.mutateAsync({
              unidadeId,
              profissionalId: horario.profissionalId,
              ...clienteParaApi(cliente),
              inicio: horario.inicio,
              servicoIds: escolhidos,
              origem: 'balcao',
            });
            fechar();
            router.push(`/comandas?id=${r.id}`);
          } catch (er) {
            setErro(
              er instanceof ErroApi
                ? (er.campos[0]?.mensagem ?? er.message)
                : 'Não foi possível agendar.',
            );
          }
        }}
      >
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <BuscaCliente id="agendar" valor={cliente} onEscolher={setCliente} />
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-medium">Serviços</legend>
          <div className="flex flex-col gap-1">
            <div className="grid gap-x-4 sm:grid-cols-2">
              {(servicos.data ?? [])
                .filter((s) => s.ativo)
                .map((s) => (
                  <Marcador
                    key={s.id}
                    id={`agendar-servico-${s.id}`}
                    rotulo={`${s.nome} · ${s.duracaoMin} min`}
                    checked={escolhidos.includes(s.id)}
                    onChange={(e) => {
                      setHorario(null);
                      setEscolhidos(
                        e.target.checked
                          ? [...escolhidos, s.id]
                          : escolhidos.filter((x) => x !== s.id),
                      );
                    }}
                  />
                ))}
            </div>
            {duracao > 0 && (
              <p className="font-denso tabular-nums text-tinta-suave">
                {duracao} min · {formatarMoeda(total)}
              </p>
            )}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="agendar-dia"
            rotulo="Dia"
            type="date"
            value={dia}
            onChange={(e) => {
              setDia(e.target.value);
              setHorario(null);
            }}
          />
          <Selecao
            id="agendar-prof"
            rotulo="Barbeiro"
            value={profissionalId}
            onChange={(e) => {
              setProfissionalId(e.target.value);
              setHorario(null);
            }}
            opcoes={[
              { valor: '', rotulo: 'Qualquer um livre' },
              ...(agenda?.profissionais ?? []).map((p) => ({ valor: p.id, rotulo: p.nome })),
            ]}
          />
        </div>
        {duracao === 0 ? (
          <p className="text-tinta-suave">Escolha os serviços para ver os horários livres.</p>
        ) : livres.isPending ? (
          <p className="text-tinta-suave">Procurando horários…</p>
        ) : (
          <fieldset className="min-w-0">
            <legend className="mb-1 text-sm font-medium">Horários livres</legend>
            <div className="flex flex-col gap-3">
              {(livres.data ?? []).every((l) => l.inicios.length === 0) && (
                <p className="text-tinta-suave">
                  Nenhum horário livre neste dia. Tente outro dia ou barbeiro.
                </p>
              )}
              {(livres.data ?? [])
                .filter((l) => l.inicios.length > 0)
                .map((l) => (
                  <div key={l.profissionalId} className="flex flex-col gap-2">
                    <span className="text-sm font-semibold">
                      {nomeProf.get(l.profissionalId) ?? 'Profissional'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {l.inicios.map((inicio) => {
                        const marcado =
                          horario?.inicio === inicio && horario.profissionalId === l.profissionalId;
                        return (
                          <button
                            key={inicio}
                            type="button"
                            aria-pressed={marcado}
                            onClick={() => setHorario({ profissionalId: l.profissionalId, inicio })}
                            className={cn(
                              'min-h-11 min-w-16 rounded-md border px-3 font-denso text-base font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-foco',
                              marcado
                                ? 'border-modulo bg-modulo text-sobre-modulo'
                                : 'border-borda hover:border-borda-forte',
                            )}
                          >
                            {formatarHora(inicio)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </fieldset>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={agendar.isPending} disabled={!cliente || !horario}>
            {horario ? `Agendar ${formatarHora(horario.inicio)}` : 'Agendar'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

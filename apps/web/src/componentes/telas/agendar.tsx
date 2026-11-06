'use client';

import {
  dataLocal,
  formatarDiaPorExtenso,
  formatarHora,
  formatarMoeda,
  formatarTelefone,
  NOMES_DIAS_CURTOS,
  type AgendamentoPublicoCriado,
  type ClienteDoLink,
  type EsperaPublicaCriada,
  type HorarioLivre,
  type UnidadePublica,
} from '@pente-fino/shared';
import { Botao, Campo, Carregando, cn, EstadoVazio, Marcador } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  CircleCheck,
  MapPin,
  MessageCircle,
  SearchX,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { IconeMarca } from '../marca';

export function proximosDias(n: number): string[] {
  const hoje = dataLocal(new Date());
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${hoje}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export const chip = (ativo: boolean) =>
  cn(
    'min-h-11 rounded-md border px-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
    ativo
      ? 'border-modulo bg-modulo text-sobre-modulo'
      : 'border-borda bg-superficie hover:border-borda-forte',
  );

export function TelaAgendar() {
  return (
    <Suspense fallback={<Carregando />}>
      <Agendar />
    </Suspense>
  );
}

function Agendar() {
  const params = useSearchParams();
  const slug = params.get('u') ?? '';
  const token = params.get('c') ?? '';
  const pagina = useQuery({
    queryKey: ['publico', slug],
    queryFn: () => api<UnidadePublica>(`publico/agendamento/${slug}`),
    enabled: /^[a-z0-9-]{3,60}$/.test(slug),
    retry: false,
  });

  if (!/^[a-z0-9-]{3,60}$/.test(slug) || pagina.isError) {
    return (
      <Moldura>
        <EstadoVazio
          icone={SearchX}
          titulo="Página de agendamento não encontrada"
          texto="Confira o link com a barbearia. Ele pode ter sido trocado ou desligado."
        />
      </Moldura>
    );
  }
  if (pagina.isPending)
    return (
      <Moldura>
        <Carregando />
      </Moldura>
    );
  return <Formulario slug={slug} u={pagina.data} token={token} />;
}

export function Moldura({
  children,
  u,
}: {
  children: React.ReactNode;
  u?: { nome: string; barbearia: string; endereco: string | null };
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-10">
      {u && (
        <header className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-modulo-texto">
            {u.nome}
          </p>
          <h1 className="font-denso text-4xl font-bold uppercase leading-none">{u.barbearia}</h1>
          {u.endereco && (
            <p className="flex items-center gap-1.5 text-tinta-suave">
              <MapPin aria-hidden className="size-4 shrink-0" /> {u.endereco}
            </p>
          )}
        </header>
      )}
      <main className="flex flex-1 flex-col gap-6">{children}</main>
      <footer className="flex items-center gap-2 text-sm text-tinta-fraca">
        <IconeMarca className="size-5" /> Agendamento pelo Pente Fino
      </footer>
    </div>
  );
}

function Formulario({ slug, u, token }: { slug: string; u: UnidadePublica; token: string }) {
  // Veio pelo link do bot: nome e telefone já preenchidos (o telefone vem do token).
  const doLink = useQuery({
    queryKey: ['publico', slug, 'cliente', token],
    queryFn: () => api<ClienteDoLink>(`publico/agendamento/${slug}/cliente?c=${token}`),
    enabled: /^[A-Za-z0-9_-]{10,20}$/.test(token),
    retry: false,
    staleTime: Infinity,
  });
  const [usarLink, setUsarLink] = useState(true);
  const cliente = usarLink ? doLink.data : undefined;
  const [servicos, setServicos] = useState<string[]>([]);
  const [profissional, setProfissional] = useState<string>('');
  const [dia, setDia] = useState(dataLocal(new Date()));
  const [horario, setHorario] = useState<{ inicio: string; profissionalId: string } | null>(null);
  const [nomeDigitado, setNome] = useState<string | null>(null);
  const nome = nomeDigitado ?? cliente?.nome ?? '';
  const [telefone, setTelefone] = useState('');
  const [lembretes, setLembretes] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<AgendamentoPublicoCriado | null>(null);
  const dias = useMemo(() => proximosDias(14), []);

  const livres = useQuery({
    queryKey: ['publico', slug, 'horarios', servicos.join(','), dia, profissional],
    queryFn: () =>
      api<HorarioLivre[]>(
        `publico/agendamento/${slug}/horarios?data=${dia}&servicoIds=${servicos.join(',')}${profissional ? `&profissionalId=${profissional}` : ''}`,
      ),
    enabled: servicos.length > 0,
  });
  // "Sem preferência": cada horário com o primeiro barbeiro livre nele.
  const opcoes = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of livres.data ?? [])
      for (const i of l.inicios) if (!m.has(i)) m.set(i, l.profissionalId);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [livres.data]);
  const total = servicos.reduce(
    (s, id) => s + (u.servicos.find((x) => x.id === id)?.preco ?? 0),
    0,
  );
  const duracao = servicos.reduce(
    (s, id) => s + (u.servicos.find((x) => x.id === id)?.duracaoMin ?? 0),
    0,
  );

  if (feito) {
    return (
      <Moldura u={u}>
        <section
          className="flex flex-col gap-4 rounded-lg border-2 border-acao bg-superficie p-5"
          aria-live="polite"
        >
          <CircleCheck aria-hidden className="size-10 text-acao-texto" strokeWidth={1.75} />
          <h2 className="text-2xl font-semibold">Horário marcado</h2>
          <p className="text-lg first-letter:uppercase">
            {formatarDiaPorExtenso(feito.inicio)}, às{' '}
            <strong className="font-denso tabular-nums">{formatarHora(feito.inicio)}</strong>, com{' '}
            {feito.profissional}
          </p>
          <p className="text-tinta-suave">
            {feito.servicos.join(' + ')} · {formatarMoeda(feito.total)}
          </p>
          {feito.lembretes === 'ativar' && feito.linkLembretes && (
            <div className="flex flex-col gap-2 rounded-md border border-borda bg-fundo p-4">
              <p className="font-semibold">Falta um passo para os lembretes</p>
              <p className="text-sm text-tinta-suave">
                O WhatsApp só deixa a barbearia te escrever depois que você manda a primeira
                mensagem. Toque no botão e envie o texto que já vem pronto.
              </p>
              <a
                href={feito.linkLembretes}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-acao px-4 text-lg font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
              >
                <BellRing aria-hidden className="size-5" /> Ativar lembretes no WhatsApp
              </a>
            </div>
          )}
          {feito.podeAntecipar && <AvisarAntes token={feito.linkGerenciar.split('t=')[1] ?? ''} />}
          {feito.lembretes === 'ligados' && (
            <p className="flex items-center gap-2 text-tinta-suave">
              <BellRing aria-hidden className="size-5 shrink-0" /> Você vai receber o lembrete pelo
              WhatsApp.
            </p>
          )}
          {feito.linkWhatsapp && feito.lembretes !== 'ativar' && (
            <a
              href={feito.linkWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-acao px-4 text-lg font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              <MessageCircle aria-hidden className="size-5" /> Confirmar pelo WhatsApp
            </a>
          )}
          <a
            href={feito.linkGerenciar}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-borda-forte bg-superficie px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            <CalendarClock aria-hidden className="size-5" /> Ver, remarcar ou cancelar
          </a>
          <p className="text-sm text-tinta-suave">
            Guarde este link: é por ele que você muda o horário sem precisar ligar
            {u.telefone ? ` (ou fale com a barbearia: ${formatarTelefone(u.telefone)})` : ''}.
          </p>
        </section>
      </Moldura>
    );
  }

  return (
    <Moldura u={u}>
      {u.linkWhatsappAgendar && (
        <a
          href={u.linkWhatsappAgendar}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-modulo-texto underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          <MessageCircle aria-hidden className="size-5" /> Prefere marcar pelo WhatsApp?
        </a>
      )}
      <form
        method="post"
        noValidate
        className="flex flex-col gap-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          if (!horario) return setErro('Escolha um horário.');
          setEnviando(true);
          try {
            setFeito(
              await api<AgendamentoPublicoCriado>(`publico/agendamento/${slug}`, {
                corpo: {
                  nome,
                  telefone,
                  servicoIds: servicos,
                  profissionalId: horario.profissionalId,
                  inicio: horario.inicio,
                  lembretes: u.lembretesWhatsapp && lembretes,
                  ...(cliente ? { c: token } : {}),
                },
              }),
            );
          } catch (er) {
            setErro(
              er instanceof ErroApi
                ? (er.campos[0]?.mensagem ?? er.message)
                : 'Não foi possível agendar. Tente de novo.',
            );
            void livres.refetch();
          } finally {
            setEnviando(false);
          }
        }}
      >
        <fieldset className="min-w-0">
          <legend className="mb-2 text-lg font-semibold">1. O que você vai fazer?</legend>
          <div className="flex flex-col gap-2">
            {u.servicos.length === 0 && (
              <p className="text-tinta-suave">Nenhum serviço disponível pelo link agora.</p>
            )}
            {u.servicos.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-borda bg-superficie px-3"
              >
                <Marcador
                  id={`servico-${s.id}`}
                  rotulo={`${s.nome} · ${s.duracaoMin} min`}
                  checked={servicos.includes(s.id)}
                  onChange={(e) => {
                    setHorario(null);
                    setServicos(
                      e.target.checked ? [...servicos, s.id] : servicos.filter((x) => x !== s.id),
                    );
                  }}
                />
                <span className="font-denso text-lg tabular-nums">
                  {s.preco !== null ? formatarMoeda(s.preco) : ''}
                </span>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-lg font-semibold">2. Com quem?</legend>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {[{ id: '', nome: 'Sem preferência' }, ...u.profissionais].map((p) => (
                <button
                  key={p.id || 'qualquer'}
                  type="button"
                  aria-pressed={profissional === p.id}
                  className={chip(profissional === p.id)}
                  onClick={() => {
                    setProfissional(p.id);
                    setHorario(null);
                  }}
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-lg font-semibold">3. Quando?</legend>
          <div className="flex flex-col gap-3">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {dias.map((d) => {
                const x = new Date(`${d}T12:00:00Z`);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={dia === d}
                    aria-label={formatarDiaPorExtenso(`${d}T12:00:00Z`)}
                    className={cn(
                      chip(dia === d),
                      'flex min-w-14 shrink-0 flex-col items-center py-1 leading-tight',
                    )}
                    onClick={() => {
                      setDia(d);
                      setHorario(null);
                    }}
                  >
                    <span className="text-xs uppercase">{NOMES_DIAS_CURTOS[x.getUTCDay()]}</span>
                    <span className="font-denso text-xl tabular-nums">{x.getUTCDate()}</span>
                  </button>
                );
              })}
            </div>
            {servicos.length === 0 ? (
              <p className="text-tinta-suave">Escolha o serviço para ver os horários.</p>
            ) : livres.isPending ? (
              <p className="text-tinta-suave">Procurando horários…</p>
            ) : opcoes.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-2 text-tinta-suave">
                  <CalendarCheck aria-hidden className="size-5" /> Sem horário livre neste dia.
                  Tente outro dia{profissional ? ' ou outro barbeiro' : ''}, ou peça para ser
                  avisado.
                </p>
                <AvisarSeVagar
                  slug={slug}
                  corpo={{
                    nome: cliente?.nome ?? nome,
                    telefone: cliente?.telefone ?? telefone,
                    servicoIds: servicos,
                    profissionalId: profissional || null,
                    dia,
                    ...(cliente ? { c: token } : {}),
                  }}
                />
              </div>
            ) : (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={`Horários livres (${duracao} min)`}
              >
                {opcoes.map(([inicio, profissionalId]) => (
                  <button
                    key={inicio}
                    type="button"
                    aria-pressed={horario?.inicio === inicio}
                    className={cn(
                      chip(horario?.inicio === inicio),
                      'min-w-18 font-denso text-lg tabular-nums',
                    )}
                    onClick={() => setHorario({ inicio, profissionalId })}
                  >
                    {formatarHora(inicio)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-lg font-semibold">4. Seus dados</legend>
          <div className="flex flex-col gap-4">
            <Campo
              id="agendar-nome"
              rotulo="Nome"
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            {cliente ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="flex flex-wrap items-center gap-x-3 font-denso text-lg tabular-nums">
                  {formatarTelefone(cliente.telefone)}
                  <button
                    type="button"
                    className="min-h-11 font-sans text-sm font-semibold text-modulo-texto underline-offset-4 hover:underline"
                    onClick={() => {
                      setUsarLink(false);
                      setNome('');
                    }}
                  >
                    Não é você?
                  </button>
                </p>
              </div>
            ) : (
              <Campo
                id="agendar-telefone"
                rotulo="WhatsApp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dica="Com DDD. A barbearia usa para confirmar o horário."
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            )}
            {u.lembretesWhatsapp && (
              <Marcador
                id="agendar-lembretes"
                rotulo="Quero receber lembrete do horário pelo WhatsApp"
                checked={lembretes}
                onChange={(e) => setLembretes(e.target.checked)}
              />
            )}
          </div>
        </fieldset>

        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao
          type="submit"
          larguraTotal
          className="min-h-12 text-lg"
          carregando={enviando}
          disabled={
            !horario ||
            nome.trim().length < 2 ||
            (!cliente && telefone.replace(/\D/g, '').length < 10)
          }
        >
          {horario
            ? `Agendar ${formatarHora(horario.inicio)} · ${formatarMoeda(total)}`
            : 'Agendar'}
        </Botao>
      </form>
    </Moldura>
  );
}

/** Ativar os avisos: ligados já, ou o botão que abre a conversa com o bot. */
function ResultadoDoAviso({ r, texto }: { r: EsperaPublicaCriada; texto: string }) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="flex items-center gap-2 text-acao-texto">
        <BellRing aria-hidden className="size-5 shrink-0" /> {texto}
      </p>
      {r.lembretes === 'ativar' && r.linkLembretes && (
        <a
          href={r.linkLembretes}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md bg-acao px-4 font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          <MessageCircle aria-hidden className="size-5" /> Ativar avisos no WhatsApp
        </a>
      )}
    </div>
  );
}

/** Dia sem horário livre: entra na lista de espera do dia pelo site. */
function AvisarSeVagar({ slug, corpo }: { slug: string; corpo: Record<string, unknown> }) {
  const [r, setR] = useState<EsperaPublicaCriada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (r)
    return (
      <ResultadoDoAviso
        r={r}
        texto="Combinado! Se vagar um horário nesse dia, avisamos pelo WhatsApp."
      />
    );
  return (
    <div className="flex flex-col gap-2">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Botao
        type="button"
        variante="secundario"
        className="self-start"
        carregando={enviando}
        onClick={async () => {
          setErro(null);
          setEnviando(true);
          try {
            setR(await api<EsperaPublicaCriada>(`publico/agendamento/${slug}/espera`, { corpo }));
          } catch (e) {
            setErro(
              e instanceof ErroApi
                ? (e.campos[0]?.mensagem ?? e.message)
                : 'Não deu certo. Tente de novo.',
            );
          } finally {
            setEnviando(false);
          }
        }}
      >
        <BellRing aria-hidden className="size-5" /> Avise-me se vagar neste dia
      </Botao>
      <p className="text-sm text-tinta-suave">Preencha seu nome e WhatsApp lá embaixo antes.</p>
    </div>
  );
}

/** Confirmação: foi empurrado para depois; oferece avisar se vagar antes. */
function AvisarAntes({ token }: { token: string }) {
  const [r, setR] = useState<EsperaPublicaCriada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (r)
    return (
      <ResultadoDoAviso r={r} texto="Combinado! Se vagar um horário antes do seu, avisamos." />
    );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-borda p-4">
      <p className="font-semibold">Queria mais cedo?</p>
      <p className="text-sm text-tinta-suave">
        Os horários antes deste estavam ocupados. Se algum vagar, avisamos pelo WhatsApp e você
        troca respondendo 1.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <Botao
        type="button"
        variante="secundario"
        className="self-start"
        carregando={enviando}
        onClick={async () => {
          setErro(null);
          setEnviando(true);
          try {
            setR(
              await api<EsperaPublicaCriada>(`publico/horario/${token}/antecipar`, { corpo: {} }),
            );
          } catch (e) {
            setErro(e instanceof ErroApi ? e.message : 'Não deu certo. Tente de novo.');
          } finally {
            setEnviando(false);
          }
        }}
      >
        <BellRing aria-hidden className="size-5" /> Me avise se vagar antes
      </Botao>
    </div>
  );
}

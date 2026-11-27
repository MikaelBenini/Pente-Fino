'use client';

import {
  formatarHora,
  formatarTelefone,
  ROTULO_SITUACAO,
  type ConversaResumo,
  type SituacaoConversa,
} from '@pente-fino/shared';
import {
  Botao,
  CampoTexto,
  cn,
  EstadoVazio,
  Marcador,
  ModalConfirmacao,
  Selecao,
} from '@pente-fino/ui';
import { ArrowLeft, Bot, Hand, MessagesSquare, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  notificacoesSuportadas,
  pedirPermissaoNotificacao,
  tocarAviso,
  usePreferenciasAvisos,
} from '@/lib/avisos';
import {
  chaveConversas,
  useAcao,
  useConversas,
  useEstadosConversa,
  useMensagensConversa,
} from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { ListaMensagens } from '../lista-mensagens';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';

/** "há 5 min", "há 2 h": quanto tempo o cliente está esperando. */
/**
 * A última resposta da equipe: "Diego respondeu há 5 min" ou "Respondida pelo celular há 5 min"
 * (sugestão aprovada em 16/11/2026: para ninguém responder em dobro).
 */
function textoEquipe(c: ConversaResumo): string | null {
  if (!c.equipe) return null;
  const quando = haQuanto(c.equipe.em);
  if (c.equipe.peloCelular) return `Respondida pelo celular ${quando}`;
  return `${c.equipe.quem ?? 'A equipe'} respondeu ${quando}`;
}

function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}

const nomeDa = (c: ConversaResumo) => c.cliente ?? formatarTelefone(c.telefone);

/**
 * Agenda com o cliente e, se ele pediu algo no bot, os serviços, o profissional, o dia e o
 * horário já escolhidos (sugestão aprovada em 16/11/2026).
 */
function linkAgendar(c: ConversaResumo): string {
  const q = new URLSearchParams({ agendar: c.clienteId ?? '' });
  const p = c.pedidoDados;
  if (p) {
    if (p.servicoIds.length) q.set('servicos', p.servicoIds.join(','));
    if (p.profissionalId) q.set('profissional', p.profissionalId);
    if (p.dia) q.set('dia', p.dia);
    if (p.inicio) q.set('inicio', p.inicio);
  }
  return `/agenda?${q.toString()}`;
}

/** Chegou por anúncio (pedido do dono em 16/11/2026), com o título quando o WhatsApp manda. */
function FichaAnuncio({ c }: { c: ConversaResumo }) {
  return (
    <span title={c.anuncio?.titulo ?? undefined}>
      <Ficha tom="aviso">Veio de anúncio</Ficha>
    </span>
  );
}

/**
 * Estado claro (testes de 19/11/2026): "Esperando agora" não dizia que o bot estava pausado.
 */
function FichaSituacao({ c }: { c: ConversaResumo }) {
  if (c.situacao === 'aguardando')
    return (
      <Ficha tom="aviso">
        {ROTULO_SITUACAO.aguardando}
        {c.aguardandoDesde && ` · ${haQuanto(c.aguardandoDesde)}`}
      </Ficha>
    );
  if (c.situacao === 'atendimento') return <Ficha tom="acao">{ROTULO_SITUACAO.atendimento}</Ficha>;
  // O selo segue a conexão real da unidade: desconectado, o bot não responde ninguém.
  if (!c.conectado) return <Ficha tom="perigo">Bot parado: WhatsApp desconectado</Ficha>;
  return <Ficha tom="neutro">{ROTULO_SITUACAO.bot}</Ficha>;
}

/** Por que a conversa está assim: a última mudança, com quem e quando. */
function textoMotivo(c: ConversaResumo): string | null {
  const e = c.ultimoEstado;
  if (!e) return null;
  return `${e.origemTexto}${e.quem ? ` (${e.quem})` : ''} · ${haQuanto(e.em)}`;
}

const ROTULO_CURTO: Record<SituacaoConversa, string> = {
  bot: 'Bot respondendo',
  aguardando: 'Aguardando atendente',
  atendimento: 'Em atendimento humano',
};

/** Cada mudança de estado com horário, de, para e origem (testes de 19/11/2026). */
function HistoricoEstados({ id }: { id: string }) {
  const estados = useEstadosConversa(id);
  const lista = estados.data ?? [];
  return (
    <details className="rounded-md border border-borda bg-superficie px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold">
        Histórico do estado{lista.length > 0 && ` (${lista.length})`}
      </summary>
      {lista.length === 0 ? (
        <p className="mt-2 text-tinta-suave">Nenhuma mudança registrada ainda.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5">
          {[...lista].reverse().map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <time dateTime={e.em} className="font-denso tabular-nums text-tinta-suave">
                {new Date(e.em).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </time>
              <span>
                {e.de ? `${ROTULO_CURTO[e.de]} → ` : ''}
                <strong>{ROTULO_CURTO[e.para]}</strong>
              </span>
              <span className="text-tinta-suave">
                {e.origemTexto}
                {e.quem && ` · ${e.quem}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

/**
 * Conversas do WhatsApp da unidade. Quem pediu atendente aparece primeiro; a equipe responde
 * por aqui (o bot fica quieto) e devolve ao bot quando termina.
 */
export function TelaConversas() {
  const { unidadeAtiva, unidades, papeis } = useApp();
  // Filtro da própria tela (pedido do dono em 16/11/2026): com "Todas as unidades" no alto,
  // escolher uma unidade aqui; e ver só quem veio de anúncio.
  const [filtroUnidade, setFiltroUnidade] = useState('todas');
  const [soAnuncio, setSoAnuncio] = useState(false);
  const escolhida = unidadeAtiva === 'todas' ? filtroUnidade : unidadeAtiva;
  const lista = useConversas(escolhida);
  const ativas = unidades.filter((u) => u.ativa);
  const [aberta, setAberta] = useState<string | null>(null);
  const gestao = papeis.includes('dono') || papeis.includes('gestor');
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Conversas do bot"
        pergunta="Quem está esperando resposta?"
        acao={<AvisosDesteAparelho />}
      />
      <Estado consulta={lista}>
        {() => {
          const { conectado } = lista.data!;
          const conversas = soAnuncio
            ? lista.data!.conversas.filter((c) => c.anuncio)
            : lista.data!.conversas;
          const atual = conversas.find((c) => c.id === aberta) ?? null;
          const esperando = conversas.filter((c) => c.situacao === 'aguardando');
          const outras = conversas.filter((c) => c.situacao !== 'aguardando');
          return (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-4">
                {unidadeAtiva === 'todas' && ativas.length > 1 && (
                  <div className="w-full max-w-xs">
                    <Selecao
                      id="conversas-unidade"
                      rotulo="Unidade"
                      value={filtroUnidade}
                      onChange={(e) => {
                        setFiltroUnidade(e.target.value);
                        setAberta(null);
                      }}
                      opcoes={[
                        { valor: 'todas', rotulo: 'Todas as unidades' },
                        ...ativas.map((u) => ({ valor: u.id, rotulo: u.nome })),
                      ]}
                    />
                  </div>
                )}
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={soAnuncio}
                    onChange={(e) => setSoAnuncio(e.target.checked)}
                    className="size-5 accent-[var(--modulo)]"
                  />
                  Só quem veio de anúncio
                </label>
              </div>
              {!conectado && (
                <Aviso tom="aviso">
                  O WhatsApp {escolhida === 'todas' ? 'das unidades' : 'desta unidade'} não está
                  conectado: dá para ler as conversas, mas as respostas não saem.{' '}
                  {gestao && (
                    <Link href="/bot?aba=conexao" className="font-semibold underline">
                      Conectar
                    </Link>
                  )}
                </Aviso>
              )}
              {conversas.length === 0 ? (
                <EstadoVazio
                  icone={MessagesSquare}
                  titulo={soAnuncio ? 'Nenhuma conversa de anúncio' : 'Nenhuma conversa ainda'}
                  texto={
                    soAnuncio
                      ? 'Quem chegar por um anúncio do Facebook ou do Instagram aparece aqui, marcado "Veio de anúncio".'
                      : 'Quando um cliente mandar mensagem no WhatsApp da unidade, a conversa aparece aqui. Quem pedir atendente fica no topo.'
                  }
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
                  <nav
                    aria-label="Conversas"
                    className={cn('flex min-w-0 flex-col gap-4', atual && 'hidden lg:flex')}
                  >
                    <GrupoConversas
                      titulo={`Esperando atendente (${esperando.length})`}
                      vazio="Ninguém esperando agora."
                      conversas={esperando}
                      aberta={aberta}
                      onAbrir={setAberta}
                      nomeUnidade={escolhida === 'todas' ? nomeUnidade : undefined}
                    />
                    <GrupoConversas
                      titulo="Recentes"
                      vazio="Sem outras conversas."
                      conversas={outras}
                      aberta={aberta}
                      onAbrir={setAberta}
                      nomeUnidade={escolhida === 'todas' ? nomeUnidade : undefined}
                    />
                  </nav>
                  {atual ? (
                    <Conversa
                      key={atual.id}
                      c={atual}
                      conectado={atual.conectado}
                      gestao={gestao}
                      onVoltar={() => setAberta(null)}
                    />
                  ) : (
                    <div className="hidden items-center justify-center rounded-lg border border-dashed border-borda p-8 text-center text-tinta-suave lg:flex">
                      Escolha uma conversa para ler e responder.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }}
      </Estado>
    </div>
  );
}

function GrupoConversas({
  titulo,
  vazio,
  conversas,
  aberta,
  onAbrir,
  nomeUnidade,
}: {
  titulo: string;
  vazio: string;
  conversas: ConversaResumo[];
  aberta: string | null;
  onAbrir: (id: string) => void;
  nomeUnidade?: (id: string) => string;
}) {
  const id = `grupo-${titulo.split(' ')[0]!.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        {titulo}
      </h2>
      {conversas.length === 0 ? (
        <p className="text-sm text-tinta-suave">{vazio}</p>
      ) : (
        <ul className="animar-escalonado flex flex-col gap-1.5">
          {conversas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onAbrir(c.id)}
                aria-current={aberta === c.id ? 'true' : undefined}
                className={cn(
                  'toque flex w-full flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foco',
                  aberta === c.id
                    ? 'border-acao-texto/40 bg-superficie-2'
                    : 'border-borda bg-superficie hover:bg-superficie-2',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{nomeDa(c)}</span>
                  {c.ultimaMensagem && (
                    <span className="shrink-0 text-xs text-tinta-suave">
                      {formatarHora(c.ultimaMensagem.criadoEm)}
                    </span>
                  )}
                </span>
                {c.ultimaMensagem && (
                  <span className="truncate text-sm text-tinta-suave">
                    {c.ultimaMensagem.direcao === 'saida' && 'Você: '}
                    {c.ultimaMensagem.texto || '(áudio, foto ou figurinha)'}
                  </span>
                )}
                {c.pedido && (
                  <span className="truncate text-sm font-medium text-tinta">Pediu: {c.pedido}</span>
                )}
                {c.situacao !== 'bot' && textoEquipe(c) && (
                  <span className="truncate text-xs text-tinta-suave">{textoEquipe(c)}</span>
                )}
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <FichaSituacao c={c} />
                  {c.anuncio && <FichaAnuncio c={c} />}
                  {nomeUnidade && (
                    <span className="text-tinta-suave">{nomeUnidade(c.unidadeId)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Conversa({
  c,
  conectado,
  gestao,
  onVoltar,
}: {
  c: ConversaResumo;
  conectado: boolean;
  gestao: boolean;
  onVoltar: () => void;
}) {
  const mensagens = useMensagensConversa(c.id);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [devolver, setDevolver] = useState(false);
  const [gravado, setGravado] = useState<SituacaoConversa | null>(null);
  const responder = useAcao(
    (t: string) => api(`conversas/${c.id}/responder`, { corpo: { texto: t } }),
    [chaveConversas],
  );
  const assumir = useAcao(() => api(`conversas/${c.id}/assumir`, { corpo: {} }), [chaveConversas]);
  const devolverAoBot = useAcao(
    () =>
      api<{ ok: true; situacao: SituacaoConversa }>(`conversas/${c.id}/devolver`, { corpo: {} }),
    [chaveConversas],
  );

  async function enviar() {
    if (!texto.trim()) return;
    setErro(null);
    try {
      await responder.mutateAsync(texto.trim());
      setTexto('');
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  return (
    <section aria-label={`Conversa com ${nomeDa(c)}`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Botao
            variante="fantasma"
            className="px-3 lg:hidden"
            aria-label="Voltar para a lista"
            onClick={onVoltar}
          >
            <ArrowLeft aria-hidden className="size-5" />
          </Botao>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{nomeDa(c)}</h2>
            <p className="text-sm text-tinta-suave">
              {formatarTelefone(c.telefone)}
              {c.clienteId && (
                <>
                  {' · '}
                  <Link href={`/clientes?id=${c.clienteId}`} className="underline">
                    Ver cliente
                  </Link>
                  {' · '}
                  <Link href={linkAgendar(c)} className="underline">
                    {c.pedidoDados ? 'Agendar o que pediu' : 'Agendar'}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        {c.pedido && (
          <p className="w-full text-sm">
            <span className="font-semibold">O que o cliente já pediu:</span> {c.pedido}
          </p>
        )}
        {textoEquipe(c) && <p className="w-full text-sm text-tinta-suave">{textoEquipe(c)}</p>}
        {c.situacao !== 'bot' && textoMotivo(c) && (
          <p className="w-full text-sm">
            <span className="font-semibold">Por que o bot está pausado:</span> {textoMotivo(c)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <FichaSituacao c={c} />
          {c.anuncio && <FichaAnuncio c={c} />}
          {!conectado && gestao && (
            <Link href="/bot?aba=conexao" className="text-sm font-semibold underline">
              Conectar
            </Link>
          )}
          {c.situacao !== 'atendimento' && (
            <Botao
              carregando={assumir.isPending}
              onClick={async () => {
                setErro(null);
                try {
                  await assumir.mutateAsync(undefined);
                } catch (e) {
                  setErro(mensagemDe(e));
                }
              }}
            >
              <Hand aria-hidden className="size-4" /> Assumir conversa
            </Botao>
          )}
          {c.situacao !== 'bot' && (
            <Botao variante="secundario" onClick={() => setDevolver(true)}>
              <Bot aria-hidden className="size-4" /> Devolver ao bot
            </Botao>
          )}
        </div>
      </div>
      {gravado && (
        <Aviso tom={gravado === 'bot' ? 'sucesso' : 'aviso'}>
          Estado gravado agora: {ROTULO_SITUACAO[gravado]}.
          {gravado === 'bot' &&
            ' A próxima mensagem do cliente já é respondida pelo bot (AGENDAR, por exemplo).'}
        </Aviso>
      )}
      <Estado consulta={mensagens}>
        {() => <ListaMensagens mensagens={mensagens.data!} className="h-[50dvh] min-h-64" />}
      </Estado>
      <HistoricoEstados id={c.id} />
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <form
        method="post"
        noValidate
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <CampoTexto
          id="conversa-resposta"
          rotulo="Responder"
          rows={2}
          maxLength={1000}
          disabled={!conectado}
          dica={
            conectado
              ? 'Ao responder, o bot para de falar com este cliente até você devolver. Ctrl + Enter envia.'
              : 'O WhatsApp está desconectado: a resposta não sairia.'
          }
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void enviar();
            }
          }}
        />
        <Botao
          type="submit"
          className="self-end"
          carregando={responder.isPending}
          disabled={!conectado || !texto.trim()}
        >
          <Send aria-hidden className="size-4" /> Enviar
        </Botao>
      </form>
      <ModalConfirmacao
        aberto={devolver}
        titulo="Devolver a conversa ao bot?"
        descricao="O cliente recebe a mensagem de encerramento e o bot volta a responder na hora, mesmo que ele mande AGENDAR antes de a mensagem chegar."
        textoConfirmar="Devolver ao bot"
        carregando={devolverAoBot.isPending}
        onCancelar={() => setDevolver(false)}
        onConfirmar={async () => {
          setErro(null);
          try {
            const r = await devolverAoBot.mutateAsync(undefined);
            setGravado(r.situacao);
          } catch (e) {
            setErro(mensagemDe(e));
          }
          setDevolver(false);
        }}
      />
    </section>
  );
}

/** Som e notificação quando um cliente passa a esperar atendente; valem só neste aparelho. */
function AvisosDesteAparelho() {
  const [p, mudar] = usePreferenciasAvisos();
  const [negada, setNegada] = useState(false);
  return (
    <fieldset className="flex flex-col gap-1 rounded-lg border border-borda bg-superficie px-4 py-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-tinta-suave">
        Avisos neste aparelho
      </legend>
      <Marcador
        id="aviso-som"
        rotulo="Tocar som"
        checked={p.som}
        onChange={(e) => {
          mudar({ ...p, som: e.target.checked });
          if (e.target.checked) tocarAviso();
        }}
      />
      <Marcador
        id="aviso-notificacao"
        rotulo="Notificação do navegador"
        checked={p.notificacao}
        disabled={!notificacoesSuportadas()}
        onChange={async (e) => {
          setNegada(false);
          if (!e.target.checked) return mudar({ ...p, notificacao: false });
          const permissao = await pedirPermissaoNotificacao();
          if (permissao === 'granted') mudar({ ...p, notificacao: true });
          else setNegada(true);
        }}
      />
      {negada && (
        <p className="max-w-64 text-xs text-aviso-texto">
          O navegador bloqueou as notificações. Libere no cadeado ao lado do endereço do site.
        </p>
      )}
    </fieldset>
  );
}

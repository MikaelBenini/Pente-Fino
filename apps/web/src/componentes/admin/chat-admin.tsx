'use client';

// Admin F6: o chat do site na administração. Fila e em atendimento à esquerda; a conversa aberta
// à direita, com assumir, responder e encerrar. Atualiza a cada poucos segundos.
import {
  formatarDataHora,
  type ConversaDaEquipe,
  type EstadoPush,
  type RespostaPronta,
  type ConversaNaFila,
  type ResumoDoChat,
  type UsuarioPlataformaSessao,
} from '@pente-fino/shared';
import { Botao, Selecao } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Aviso } from '../aviso';
import { Estado, Ficha } from '../pagina';
import { adminApi } from './admin-api';

const NOME_STATUS = {
  fila: 'Na fila',
  atendendo: 'Em atendimento',
  encerrada: 'Encerrada',
} as const;

/** Link do WhatsApp quando o contato é um telefone. */
function linkWhatsapp(contato: string): string | null {
  if (contato.includes('@')) return null;
  const d = contato.replace(/\D/g, '');
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`;
}

/** Bipe curto (sem arquivo de som): avisa conversa ou mensagem nova. */
function bipe() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    // Navegador sem áudio liberado: fica só o aviso visual.
  }
}

/**
 * Avisos do chat em qualquer aba da administração: conversa nova ou mensagem nova de visitante
 * tocam um bipe e, com a permissão do navegador e a aba em segundo plano, mostram uma
 * notificação. Devolve quantas conversas esperam resposta (o título da aba e a aba Chat mostram).
 */
export function useAvisosDoChat(ligado: boolean): number {
  const q = useQuery({
    queryKey: ['admin', 'chat', 'abertas'],
    queryFn: () => adminApi<ConversaNaFila[]>('chat'),
    refetchInterval: 8000,
    enabled: ligado,
  });
  const vistas = useRef<Map<string, string> | null>(null);
  const esperando = (q.data ?? []).filter((c) => c.esperandoEquipe);
  useEffect(() => {
    if (!q.data) return;
    const antes = vistas.current;
    const agora = new Map(q.data.map((c) => [c.id, c.ultimaMensagemEm]));
    vistas.current = agora;
    if (!antes) return; // primeira leitura: não avisa o que já estava lá
    const novas = q.data.filter((c) => c.esperandoEquipe && antes.get(c.id) !== c.ultimaMensagemEm);
    if (!novas.length) return;
    bipe();
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      document.hidden
    ) {
      const c = novas[0]!;
      new Notification(
        antes.has(c.id) ? `${c.nome} mandou mensagem` : `${c.nome} está no chat do site`,
        {
          body: c.ultimaMensagem,
          tag: `chat-${c.id}`,
        },
      );
    }
  }, [q.data]);
  const n = esperando.length;
  useEffect(() => {
    if (!ligado || !n) return;
    const original = document.title;
    document.title = `(${n}) Chat · ${original.replace(/^\(\d+\) Chat · /, '')}`;
    return () => {
      document.title = original;
    };
  }, [ligado, n]);
  return n;
}

/** Chave VAPID (base64url) no formato que o navegador pede. */
function chaveDoServidor(base64: string): Uint8Array<ArrayBuffer> {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bruto = atob(b);
  const saida = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

/**
 * Admin F6: aviso no celular (push), mesmo com o navegador fechado. Liga neste aparelho; no
 * iPhone, só com o Pente Fino instalado na tela de início.
 */
function PushNoCelular() {
  const estado = useQuery({
    queryKey: ['admin', 'chat', 'push'],
    queryFn: () => adminApi<EstadoPush>('chat/push'),
  });
  const [inscrito, setInscrito] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const suportado =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    if (!suportado) return;
    void navigator.serviceWorker
      .getRegistration('/')
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => setInscrito(!!s));
  }, [suportado]);

  if (!suportado || !estado.data?.chavePublica) return null;

  async function ligar() {
    setErro(null);
    setOcupado(true);
    try {
      if ((await Notification.requestPermission()) !== 'granted')
        throw new Error('O navegador não deu permissão para notificações.');
      const r =
        (await navigator.serviceWorker.getRegistration('/')) ??
        (await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }));
      const s =
        (await r.pushManager.getSubscription()) ??
        (await r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveDoServidor(estado.data!.chavePublica!),
        }));
      await adminApi('chat/push', { corpo: s.toJSON() });
      setInscrito(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ligar o aviso no celular.');
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const s = await (
        await navigator.serviceWorker.getRegistration('/')
      )?.pushManager.getSubscription();
      if (s) await adminApi('chat/push/desligar', { corpo: { endpoint: s.endpoint } });
      setInscrito(false);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {inscrito ? (
        <Botao variante="secundario" carregando={ocupado} onClick={() => void desligar()}>
          Desligar aviso no celular
        </Botao>
      ) : (
        <Botao variante="secundario" carregando={ocupado} onClick={() => void ligar()}>
          Avisar no celular
        </Botao>
      )}
      {erro && <span className="text-xs text-perigo-texto">{erro}</span>}
    </div>
  );
}

function AtivarNotificacoes() {
  const [permissao, setPermissao] = useState(() =>
    typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission,
  );
  if (permissao !== 'default') return null;
  return (
    <Botao
      variante="secundario"
      onClick={() => void Notification.requestPermission().then((p) => setPermissao(p))}
    >
      Ativar avisos do navegador
    </Botao>
  );
}

function ResumoChat() {
  const r = useQuery({
    queryKey: ['admin', 'chat', 'resumo'],
    queryFn: () => adminApi<ResumoDoChat>('chat/resumo'),
    refetchInterval: 60_000,
  });
  if (!r.data) return null;
  const d = r.data;
  return (
    <dl
      aria-label="Chat nos últimos 30 dias"
      className="grid gap-3 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          Conversas (30 dias)
        </dt>
        <dd className="text-2xl font-semibold tabular-nums">{d.conversas}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          Viraram cadastro
        </dt>
        <dd className="text-2xl font-semibold tabular-nums">
          {d.viraramCadastro}
          <span className="ml-2 text-sm font-normal text-tinta-suave">
            {Math.round(d.taxaCadastro * 100)}%
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          Acharam útil
        </dt>
        <dd className="text-2xl font-semibold tabular-nums">
          {d.avaliadas ? `${Math.round((d.uteis / d.avaliadas) * 100)}%` : '—'}
          <span className="ml-2 text-sm font-normal text-tinta-suave">
            {d.avaliadas} {d.avaliadas === 1 ? 'avaliação' : 'avaliações'}
          </span>
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-tinta-suave">
          1ª resposta, em média
        </dt>
        <dd className="text-2xl font-semibold tabular-nums">
          {d.primeiraRespostaMin === null ? '—' : `${d.primeiraRespostaMin} min`}
          {d.semResposta > 0 && (
            <span className="ml-2 text-sm font-normal text-tinta-suave">
              {d.semResposta} sem resposta
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}

export function ChatAdmin({
  u,
  onAbrirConta,
}: {
  u: UsuarioPlataformaSessao;
  onAbrirConta: (id: string) => void;
}) {
  const cliente = useQueryClient();
  const [ver, setVer] = useState<'abertas' | 'encerrada'>('abertas');
  const [aberta, setAberta] = useState<string | null>(null);
  const lista = useQuery({
    queryKey: ['admin', 'chat', ver],
    queryFn: () =>
      adminApi<ConversaNaFila[]>(ver === 'encerrada' ? 'chat?status=encerrada' : 'chat'),
    refetchInterval: 5000,
  });
  const atualizar = () => cliente.invalidateQueries({ queryKey: ['admin', 'chat'] });
  const naFila = (lista.data ?? []).filter((c) => c.status === 'fila').length;

  return (
    <section aria-labelledby="titulo-chat" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="titulo-chat" className="text-3xl font-semibold">
            Chat do site
          </h1>
          <p className="text-sm text-tinta-suave">
            {ver === 'abertas'
              ? naFila
                ? `${naFila} ${naFila === 1 ? 'pessoa esperando' : 'pessoas esperando'} na fila.`
                : 'Ninguém esperando agora.'
              : 'As 50 últimas conversas encerradas.'}
          </p>
        </div>
        <AtivarNotificacoes />
        <PushNoCelular />
        <Selecao
          id="chat-ver"
          rotulo="Mostrar"
          value={ver}
          onChange={(e) => {
            setVer(e.target.value as 'abertas' | 'encerrada');
            setAberta(null);
          }}
          opcoes={[
            { valor: 'abertas', rotulo: 'Fila e em atendimento' },
            { valor: 'encerrada', rotulo: 'Encerradas' },
          ]}
        />
      </div>
      <ResumoChat />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Estado consulta={lista}>
          {() =>
            lista.data!.length === 0 ? (
              <p className="rounded-lg border border-borda bg-superficie p-4 text-sm text-tinta-suave">
                Nenhuma conversa aqui.
              </p>
            ) : (
              <ul aria-label="Conversas" className="flex flex-col gap-2">
                {lista.data!.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setAberta(c.id)}
                      aria-current={aberta === c.id}
                      className={`flex w-full flex-col gap-1 rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-foco ${
                        aberta === c.id
                          ? 'border-modulo bg-superficie-2'
                          : 'border-borda bg-superficie hover:bg-superficie-2'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {c.nome}
                          {c.origem === 'painel' && (
                            <span className="ml-2 align-middle">
                              <Ficha tom="neutro">Cliente</Ficha>
                            </span>
                          )}
                        </span>
                        <Ficha
                          tom={
                            c.status === 'fila'
                              ? 'aviso'
                              : c.status === 'atendendo'
                                ? 'acao'
                                : 'neutro'
                          }
                        >
                          {NOME_STATUS[c.status]}
                        </Ficha>
                      </span>
                      <span className="line-clamp-2 text-sm text-tinta-suave">
                        {c.ultimaMensagem}
                      </span>
                      <span className="text-xs text-tinta-fraca">
                        {formatarDataHora(c.ultimaMensagemEm)}
                        {c.atendente ? ` · ${c.atendente}` : ''}
                        {c.esperandoEquipe ? ' · esperando resposta' : ''}
                      </span>
                      {c.virouConta && (
                        <span className="text-xs font-semibold text-acao-texto">
                          Virou cadastro: {c.virouConta.nome}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </Estado>
        {aberta ? (
          <Conversa
            key={aberta}
            id={aberta}
            u={u}
            onMudou={atualizar}
            onAbrirConta={onAbrirConta}
          />
        ) : (
          <p className="rounded-lg border border-dashed border-borda p-6 text-sm text-tinta-suave">
            Escolha uma conversa para ler e responder.
          </p>
        )}
      </div>
    </section>
  );
}

function Conversa({
  id,
  u,
  onMudou,
  onAbrirConta,
}: {
  id: string;
  u: UsuarioPlataformaSessao;
  onMudou: () => void;
  onAbrirConta: (id: string) => void;
}) {
  const respostas = useQuery({
    queryKey: ['admin', 'chat', 'respostas'],
    queryFn: () => adminApi<RespostaPronta[]>('chat/respostas'),
    staleTime: 5 * 60_000,
  });
  const c = useQuery({
    queryKey: ['admin', 'chat', 'conversa', id],
    queryFn: () => adminApi<ConversaDaEquipe>(`chat/${id}`),
    refetchInterval: 4000,
  });
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function acao(caminho: string, corpo: object = {}) {
    setErro(null);
    setOcupado(true);
    try {
      await adminApi(`chat/${id}/${caminho}`, { corpo });
      await c.refetch();
      onMudou();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo. Tente de novo.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Estado consulta={c}>
      {() => {
        const d = c.data!;
        const minha = d.atendente === u.nome;
        const whatsapp = linkWhatsapp(d.contato);
        return (
          <article
            aria-label={`Conversa com ${d.nome}`}
            className="flex min-h-[28rem] flex-col rounded-lg border border-borda bg-superficie"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-borda p-4">
              <div>
                <h2 className="text-lg font-semibold">{d.nome}</h2>
                <p className="text-sm text-tinta-suave">
                  {d.contato}
                  {whatsapp && (
                    <>
                      {' · '}
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-acao-texto underline underline-offset-2"
                      >
                        Chamar no WhatsApp
                      </a>
                    </>
                  )}
                </p>
                <p className="text-xs text-tinta-fraca">
                  Começou em {formatarDataHora(d.criadoEm)}
                  {d.pagina ? ` na página ${d.pagina}` : ''}
                  {d.atendente ? ` · atendida por ${d.atendente}` : ''}
                </p>
                {d.virouConta && (
                  <p className="mt-1">
                    <Ficha tom="acao">Virou cadastro: {d.virouConta.nome}</Ficha>
                  </p>
                )}
                {d.avaliacao !== null && (
                  <p className="mt-1 text-sm">
                    {d.avaliacao ? '👍 O visitante achou útil.' : '👎 O visitante não achou útil.'}
                  </p>
                )}
                {/* Conversa da Ajuda: quem atende vê a conta sem procurar. */}
                {d.contexto && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {d.contexto.plano} · {d.contexto.status}
                      {d.contexto.nota !== null && ` · saúde ${d.contexto.nota}`}
                      {d.contexto.motivo && (
                        <span className="text-tinta-suave"> ({d.contexto.motivo})</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAbrirConta(d.contexto!.contaId)}
                      className="font-semibold text-acao-texto underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-foco"
                    >
                      Abrir ficha da conta
                    </button>
                  </div>
                )}
              </div>
              {d.status !== 'encerrada' && (
                <div className="flex gap-2">
                  {!minha && (
                    <Botao
                      variante="secundario"
                      carregando={ocupado}
                      onClick={() => void acao('assumir')}
                    >
                      Assumir
                    </Botao>
                  )}
                  <Botao
                    variante="secundario"
                    carregando={ocupado}
                    onClick={() => void acao('encerrar')}
                  >
                    Encerrar
                  </Botao>
                </div>
              )}
            </header>
            <ol aria-label="Mensagens" className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {d.mensagens.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                    m.de === 'equipe' ? 'self-end bg-modulo/20' : 'self-start bg-superficie-3'
                  }`}
                >
                  <span className="block text-xs font-semibold text-tinta-suave">
                    {m.de === 'equipe' ? (m.autor ?? 'Equipe') : d.nome} ·{' '}
                    {formatarDataHora(m.criadoEm)}
                  </span>
                  {m.texto}
                </li>
              ))}
            </ol>
            {d.status !== 'encerrada' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!texto.trim()) return;
                  void acao('mensagens', { texto }).then((ok) => ok && setTexto(''));
                }}
                className="flex items-end gap-2 border-t border-borda p-3"
              >
                <Selecao
                  id={`pronta-${id}`}
                  rotulo="Resposta pronta"
                  value=""
                  onChange={(e) => {
                    const r = respostas.data?.find((x) => x.titulo === e.target.value);
                    if (r) setTexto(r.texto);
                  }}
                  opcoes={[
                    { valor: '', rotulo: 'Escolher…' },
                    ...(respostas.data ?? []).map((r) => ({ valor: r.titulo, rotulo: r.titulo })),
                  ]}
                />
                <label className="sr-only" htmlFor={`resposta-${id}`}>
                  Resposta
                </label>
                <textarea
                  id={`resposta-${id}`}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder={minha ? 'Escreva a resposta' : 'Responder assume a conversa'}
                  className="w-full resize-none rounded-md border border-borda bg-fundo px-3 py-2 text-sm focus:border-modulo focus:outline-none"
                />
                <Botao type="submit" carregando={ocupado} disabled={!texto.trim()}>
                  Enviar
                </Botao>
              </form>
            )}
            {erro && (
              <div className="p-3">
                <Aviso tom="erro">{erro}</Aviso>
              </div>
            )}
          </article>
        );
      }}
    </Estado>
  );
}

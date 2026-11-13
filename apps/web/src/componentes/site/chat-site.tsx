'use client';

// Admin F6: chat do site. Botão no canto; o visitante deixa nome e contato, escreve a dúvida e
// entra na fila da equipe. A conversa fica guardada neste navegador (id + segredo) e as
// mensagens chegam a cada poucos segundos enquanto o chat está aberto.
import {
  avisoDoChat,
  TEXTO_HORARIO_CHAT,
  type ChatDoVisitante,
  type ChatIniciado,
} from '@pente-fino/shared';
import { MessageCircle, Send, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { eventoGoogle } from './tag-google';

const CHAVE = 'pf-chat';
const INTERVALO_ABERTO_MS = 4000;
const INTERVALO_FECHADO_MS = 20000;

type Guardada = ChatIniciado & { vistas?: number };

function ler(): Guardada | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Guardada | null;
    return v?.id && v.token ? v : null;
  } catch {
    return null;
  }
}
/** Admin F6: a conversa do chat deste navegador, para ligar ao cadastro (conversão do chat). */
export function conversaDoChat(): { id: string; token: string } | null {
  const g = ler();
  return g ? { id: g.id, token: g.token } : null;
}

function guardar(v: Guardada | null) {
  try {
    if (v) localStorage.setItem(CHAVE, JSON.stringify(v));
    else localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento (aba anônima): a conversa vale até fechar a aba.
  }
}

async function chamar<T>(caminho: string, token: string | null, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api/chat/${caminho}`, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: {
      ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { 'x-chat-token': token } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    credentials: 'same-origin',
  });
  if (r.status === 204) return undefined as T;
  const json = (await r.json().catch(() => null)) as { erro?: { mensagem?: string } } | null;
  if (!r.ok)
    throw Object.assign(new Error(json?.erro?.mensagem ?? 'Não deu para enviar.'), {
      status: r.status,
    });
  return json as T;
}

const campo =
  'w-full rounded-md border border-borda bg-fundo px-3 py-2 text-sm text-tinta placeholder:text-tinta-fraca focus:border-modulo focus:outline-none';

export function ChatSite() {
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState<Guardada | null>(null);
  const [dados, setDados] = useState<ChatDoVisitante | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState('');
  const lista = useRef<HTMLOListElement>(null);
  const idPainel = useId();

  // A conversa guardada neste navegador (depois de montar, para não divergir do servidor).
  useEffect(() => {
    const g = ler();
    if (g) queueMicrotask(() => setConversa(g));
  }, []);

  const atualizar = useCallback(async (c: Guardada) => {
    try {
      setDados(await chamar<ChatDoVisitante>(`conversas/${c.id}`, c.token));
    } catch (e) {
      // Conversa apagada ou segredo perdido: começa do zero.
      if ((e as { status?: number }).status === 404) {
        guardar(null);
        setConversa(null);
        setDados(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!conversa) return;
    const primeira = setTimeout(() => void atualizar(conversa), 0);
    const t = setInterval(
      () => void atualizar(conversa),
      aberto ? INTERVALO_ABERTO_MS : INTERVALO_FECHADO_MS,
    );
    return () => {
      clearTimeout(primeira);
      clearInterval(t);
    };
  }, [conversa, aberto, atualizar]);

  const total = dados?.mensagens.length ?? 0;
  const naoLidas = aberto ? 0 : Math.max(0, total - (conversa?.vistas ?? total));

  // Resposta nova com o chat fechado: o título da aba avisa, mesmo em outra aba do navegador.
  useEffect(() => {
    if (!naoLidas) return;
    const original = document.title;
    document.title = `(${naoLidas}) Nova mensagem · Pente Fino`;
    return () => {
      document.title = original;
    };
  }, [naoLidas]);

  // Aberto: marca tudo como visto e desce para a última mensagem.
  useEffect(() => {
    if (!aberto || !conversa || !dados) return;
    if (conversa.vistas !== total) {
      const c = { ...conversa, vistas: total };
      guardar(c);
      queueMicrotask(() => setConversa(c));
    }
    lista.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [aberto, total, conversa, dados]);

  async function iniciar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    setEnviando(true);
    try {
      const c = await chamar<ChatIniciado>('conversas', null, {
        nome: String(f.get('nome') ?? ''),
        contato: String(f.get('contato') ?? ''),
        texto: String(f.get('texto') ?? ''),
        pagina: window.location.pathname,
      });
      const g = { ...c, vistas: 1 };
      guardar(g);
      setConversa(g);
      eventoGoogle('chat_iniciado', { pagina: window.location.pathname });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!conversa || !texto.trim()) return;
    setErro(null);
    setEnviando(true);
    try {
      await chamar(`conversas/${conversa.id}/mensagens`, conversa.token, { texto });
      setTexto('');
      await atualizar(conversa);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function novaConversa() {
    guardar(null);
    setConversa(null);
    setDados(null);
    setErro(null);
  }

  return (
    <>
      {aberto && (
        <section
          id={idPainel}
          aria-label="Chat com o Pente Fino"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-borda-forte bg-superficie shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-borda px-4 py-3">
            <div>
              <h2 className="font-semibold">Fale com o Pente Fino</h2>
              <p className="text-xs text-tinta-suave">{TEXTO_HORARIO_CHAT}</p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar o chat"
              className="grid size-9 place-items-center rounded-md text-tinta-suave hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>

          {!conversa ? (
            <form
              onSubmit={(e) => void iniciar(e)}
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
            >
              <p className="text-sm text-tinta-suave">
                Tire suas dúvidas sobre o sistema, os planos ou o teste grátis. Uma pessoa da equipe
                responde.
              </p>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Seu nome
                <input
                  name="nome"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  className={campo}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                WhatsApp ou e-mail
                <input
                  name="contato"
                  required
                  maxLength={120}
                  autoComplete="email"
                  placeholder="(11) 98888-7777"
                  className={campo}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                Sua dúvida
                <textarea
                  name="texto"
                  required
                  maxLength={2000}
                  rows={4}
                  className={`${campo} flex-1 resize-none`}
                />
              </label>
              {erro && (
                <p role="alert" className="text-sm text-perigo-texto">
                  {erro}
                </p>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="min-h-11 rounded-md bg-acao px-4 font-semibold text-sobre-acao hover:brightness-95 focus-visible:outline-2 focus-visible:outline-foco disabled:opacity-60"
              >
                {enviando ? 'Enviando…' : 'Começar conversa'}
              </button>
            </form>
          ) : (
            <>
              {dados && (
                <p
                  role="status"
                  className="border-b border-borda bg-superficie-2 px-4 py-2 text-xs text-tinta-suave"
                >
                  {avisoDoChat(dados)}
                </p>
              )}
              <ol
                ref={lista}
                aria-label="Mensagens"
                className="flex flex-1 flex-col gap-2 overflow-y-auto p-4"
              >
                {dados?.mensagens.map((m) => (
                  <li
                    key={m.id}
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                      m.de === 'visitante'
                        ? 'self-end bg-modulo/20 text-tinta'
                        : 'self-start bg-superficie-3 text-tinta'
                    }`}
                  >
                    {m.de === 'equipe' && m.autor && (
                      <span className="block text-xs font-semibold text-modulo-texto">
                        {m.autor}
                      </span>
                    )}
                    {m.texto}
                  </li>
                ))}
              </ol>
              {dados?.status === 'encerrada' ? (
                <div className="border-t border-borda p-3">
                  <button
                    type="button"
                    onClick={novaConversa}
                    className="min-h-11 w-full rounded-md border border-borda font-semibold hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-foco"
                  >
                    Começar outra conversa
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => void enviar(e)}
                  className="flex items-end gap-2 border-t border-borda p-3"
                >
                  <label className="sr-only" htmlFor={`${idPainel}-texto`}>
                    Mensagem
                  </label>
                  <textarea
                    id={`${idPainel}-texto`}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    maxLength={2000}
                    placeholder="Escreva sua mensagem"
                    className={`${campo} resize-none`}
                  />
                  <button
                    type="submit"
                    disabled={enviando || !texto.trim()}
                    aria-label="Enviar mensagem"
                    className="grid size-11 shrink-0 place-items-center rounded-md bg-acao text-sobre-acao hover:brightness-95 focus-visible:outline-2 focus-visible:outline-foco disabled:opacity-60"
                  >
                    <Send aria-hidden className="size-5" />
                  </button>
                </form>
              )}
              {erro && (
                <p role="alert" className="px-4 pb-3 text-sm text-perigo-texto">
                  {erro}
                </p>
              )}
            </>
          )}
        </section>
      )}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={naoLidas ? `Chat: ${naoLidas} mensagem nova` : 'Abrir o chat com o Pente Fino'}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex min-h-14 items-center gap-2 rounded-full bg-acao px-5 font-semibold text-sobre-acao shadow-2xl hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
      >
        <MessageCircle aria-hidden className="size-6" />
        <span className="hidden sm:inline">{aberto ? 'Fechar' : 'Fale com a gente'}</span>
        {naoLidas > 0 && (
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-full bg-perigo text-xs text-white"
          >
            {naoLidas}
          </span>
        )}
      </button>
    </>
  );
}

'use client';

import { formatarHora, formatarTelefone, type ConversaResumo } from '@pente-fino/shared';
import { Botao, CampoTexto, cn, EstadoVazio, ModalConfirmacao } from '@pente-fino/ui';
import { ArrowLeft, Bot, MessagesSquare, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaveConversas, useAcao, useConversas, useMensagensConversa } from '@/lib/consultas';
import { Aviso } from '../aviso';
import { useApp } from '../contexto-app';
import { ListaMensagens } from '../lista-mensagens';
import { CabecalhoPagina, Estado, Ficha } from '../pagina';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';

/** "há 5 min", "há 2 h": quanto tempo o cliente está esperando. */
function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - Date.parse(iso)) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}

const nomeDa = (c: ConversaResumo) => c.cliente ?? formatarTelefone(c.telefone);

function FichaSituacao({ c }: { c: ConversaResumo }) {
  if (c.situacao === 'aguardando')
    return <Ficha tom="aviso">Esperando {c.aguardandoDesde && haQuanto(c.aguardandoDesde)}</Ficha>;
  if (c.situacao === 'atendimento') return <Ficha tom="acao">Com a equipe</Ficha>;
  return <Ficha tom="neutro">Bot respondendo</Ficha>;
}

/**
 * Conversas do WhatsApp da unidade. Quem pediu atendente aparece primeiro; a equipe responde
 * por aqui (o bot fica quieto) e devolve ao bot quando termina.
 */
export function TelaConversas() {
  const { unidadeAtiva, unidades, papeis } = useApp();
  const lista = useConversas(unidadeAtiva);
  const [aberta, setAberta] = useState<string | null>(null);
  const gestao = papeis.includes('dono') || papeis.includes('gestor');
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? '';

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Conversas do bot" pergunta="Quem está esperando resposta?" />
      <Estado consulta={lista}>
        {() => {
          const { conversas, conectado } = lista.data!;
          const atual = conversas.find((c) => c.id === aberta) ?? null;
          const esperando = conversas.filter((c) => c.situacao === 'aguardando');
          const outras = conversas.filter((c) => c.situacao !== 'aguardando');
          return (
            <div className="flex flex-col gap-4">
              {!conectado && (
                <Aviso tom="aviso">
                  O WhatsApp {unidadeAtiva === 'todas' ? 'das unidades' : 'desta unidade'} não está
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
                  titulo="Nenhuma conversa ainda"
                  texto="Quando um cliente mandar mensagem no WhatsApp da barbearia, a conversa aparece aqui. Quem pedir atendente fica no topo."
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
                      nomeUnidade={unidadeAtiva === 'todas' ? nomeUnidade : undefined}
                    />
                    <GrupoConversas
                      titulo="Recentes"
                      vazio="Sem outras conversas."
                      conversas={outras}
                      aberta={aberta}
                      onAbrir={setAberta}
                      nomeUnidade={unidadeAtiva === 'todas' ? nomeUnidade : undefined}
                    />
                  </nav>
                  {atual ? (
                    <Conversa
                      key={atual.id}
                      c={atual}
                      conectado={conectado}
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
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <FichaSituacao c={c} />
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
  onVoltar,
}: {
  c: ConversaResumo;
  conectado: boolean;
  onVoltar: () => void;
}) {
  const mensagens = useMensagensConversa(c.id);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [devolver, setDevolver] = useState(false);
  const responder = useAcao(
    (t: string) => api(`conversas/${c.id}/responder`, { corpo: { texto: t } }),
    [chaveConversas],
  );
  const devolverAoBot = useAcao(
    () => api(`conversas/${c.id}/devolver`, { corpo: {} }),
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
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FichaSituacao c={c} />
          {c.situacao !== 'bot' && (
            <Botao variante="secundario" onClick={() => setDevolver(true)}>
              <Bot aria-hidden className="size-4" /> Devolver ao bot
            </Botao>
          )}
        </div>
      </div>
      <Estado consulta={mensagens}>
        {() => <ListaMensagens mensagens={mensagens.data!} className="h-[50dvh] min-h-64" />}
      </Estado>
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
        descricao="O cliente recebe a mensagem de encerramento e o bot volta a responder pelo menu."
        textoConfirmar="Devolver ao bot"
        carregando={devolverAoBot.isPending}
        onCancelar={() => setDevolver(false)}
        onConfirmar={async () => {
          setErro(null);
          try {
            await devolverAoBot.mutateAsync(undefined);
          } catch (e) {
            setErro(mensagemDe(e));
          }
          setDevolver(false);
        }}
      />
    </section>
  );
}

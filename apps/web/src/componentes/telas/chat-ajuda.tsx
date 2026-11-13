'use client';

// Admin F6: o chat com o suporte do Pente Fino dentro da Ajuda, para quem já é cliente. Logado:
// sem nome nem contato; a conversa fica ligada à conta. Atualiza a cada poucos segundos.
import { avisoDoChat, TEXTO_HORARIO_CHAT, type ChatDoVisitante } from '@pente-fino/shared';
import { Botao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { AvaliarChat } from '../avaliar-chat';
import { Aviso } from '../aviso';

export function ChatAjuda() {
  const q = useQuery({
    queryKey: ['chat', 'minha'],
    queryFn: async () => (await api<{ conversa: ChatDoVisitante | null }>('chat/minha')).conversa,
    refetchInterval: 4000,
  });
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const lista = useRef<HTMLOListElement>(null);
  const d = q.data ?? null;
  const total = d?.mensagens.length ?? 0;
  const aberta = d && d.status !== 'encerrada';

  useEffect(() => {
    lista.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [total]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    setEnviando(true);
    try {
      await api('chat/minha/mensagens', { corpo: { texto } });
      setTexto('');
      await q.refetch();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-tinta-suave">
        Escreva aqui e uma pessoa da equipe responde nesta tela. {TEXTO_HORARIO_CHAT}.
      </p>
      {d && (
        <p role="status" className="rounded-md bg-superficie-2 px-3 py-2 text-sm text-tinta-suave">
          {aberta
            ? avisoDoChat(d)
            : 'Sua última conversa foi encerrada. Escreva para começar outra.'}
        </p>
      )}
      {d && d.status === 'encerrada' && (
        <AvaliarChat
          avaliacao={d.avaliacao}
          onAvaliar={async (util) => {
            await api('chat/minha/avaliacao', { corpo: { util } });
            await q.refetch();
          }}
        />
      )}
      {d && d.mensagens.length > 0 && (
        <ol
          ref={lista}
          aria-label="Mensagens com o suporte"
          className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border border-borda bg-fundo p-3"
        >
          {d.mensagens.map((m) => (
            <li
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                m.de === 'visitante' ? 'self-end bg-modulo/20' : 'self-start bg-superficie-3'
              }`}
            >
              {m.de === 'equipe' && (
                <span className="block text-xs font-semibold text-modulo-texto">
                  {m.autor ?? 'Suporte'}
                </span>
              )}
              {m.texto}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(e) => void enviar(e)} className="flex items-end gap-2">
        <label className="sr-only" htmlFor="chat-ajuda-texto">
          Mensagem para o suporte
        </label>
        <textarea
          id="chat-ajuda-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={aberta ? 'Escreva sua mensagem' : 'Conte o que estava tentando fazer'}
          className="w-full resize-none rounded-md border border-borda bg-fundo px-3 py-2 text-sm focus:border-modulo focus:outline-none"
        />
        <Botao
          type="submit"
          carregando={enviando}
          disabled={!texto.trim()}
          aria-label="Enviar ao suporte"
        >
          <Send aria-hidden className="size-4" />
        </Botao>
      </form>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </div>
  );
}

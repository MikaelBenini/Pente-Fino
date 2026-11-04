'use client';

import { formatarDataHora, type MensagemDoCliente } from '@pente-fino/shared';
import { cn } from '@pente-fino/ui';
import { useEffect, useRef } from 'react';

const SITUACAO_ENVIO: Partial<Record<MensagemDoCliente['status'], string>> = {
  pendente: 'enviando…',
  falhou: 'não enviada',
  descartada: 'não enviada',
};

/**
 * Mensagens do WhatsApp como no celular: cliente à esquerda, barbearia à direita. Desce
 * sozinha até a última quando chega mensagem nova.
 */
export function ListaMensagens({
  mensagens,
  className,
}: {
  mensagens: readonly MensagemDoCliente[];
  className?: string;
}) {
  const lista = useRef<HTMLOListElement>(null);
  const ultima = mensagens.at(-1)?.id;
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ultima]);
  return (
    <ol
      ref={lista}
      aria-label="Mensagens do WhatsApp"
      className={cn(
        'flex flex-col gap-2 overflow-y-auto rounded-md border border-borda bg-superficie-2 p-3',
        className,
      )}
    >
      {mensagens.map((m) => {
        const doCliente = m.direcao === 'entrada';
        const situacao = SITUACAO_ENVIO[m.status];
        return (
          <li
            key={m.id}
            className={cn(
              'max-w-[85%] rounded-lg border px-3 py-2',
              doCliente
                ? 'self-start border-borda bg-superficie'
                : 'self-end border-acao-texto/30 bg-superficie',
            )}
          >
            <p className="text-sm break-words whitespace-pre-line">
              {m.texto || (
                <span className="italic text-tinta-suave">(áudio, foto ou figurinha)</span>
              )}
            </p>
            <p className="mt-1 text-xs text-tinta-suave">
              {doCliente ? 'Cliente' : 'Barbearia'} · {formatarDataHora(m.criadoEm)}
              {situacao && (
                <span className={m.status === 'pendente' ? '' : 'text-perigo-texto'}>
                  {' '}
                  · {situacao}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

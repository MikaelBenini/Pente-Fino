'use client';

import { LinkBotao } from '@/componentes/site/link-botao';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '@/lib/api';

/** Link do e-mail de boas-vindas: confirma na hora e leva ao painel. */
export function ConfirmarEmail() {
  const token = useSearchParams().get('token');
  const cliente = useQueryClient();
  const [estado, setEstado] = useState<'confirmando' | 'ok' | 'erro'>(
    token ? 'confirmando' : 'erro',
  );
  const [mensagem, setMensagem] = useState('O link está incompleto. Abra de novo pelo e-mail.');
  const feito = useRef(false);

  useEffect(() => {
    if (!token || feito.current) return;
    feito.current = true;
    api('publico/confirmar-email', { corpo: { token } })
      .then(async () => {
        await cliente.invalidateQueries({ queryKey: ['auth', 'eu'] });
        setEstado('ok');
      })
      .catch((e: unknown) => {
        setMensagem(
          e instanceof ErroApi
            ? e.message
            : 'Não foi possível confirmar agora. Tente de novo em instantes.',
        );
        setEstado('erro');
      });
  }, [token, cliente]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-5">
      {estado === 'confirmando' && <p className="text-tinta-suave">Confirmando seu e-mail…</p>}
      {estado === 'ok' && (
        <>
          <CircleCheck aria-hidden className="size-10 text-acao-texto" />
          <h1 className="text-3xl font-semibold">E-mail confirmado</h1>
          <p className="text-tinta-suave">
            Pronto: a agenda, os convites da equipe e o WhatsApp estão liberados.
          </p>
          <LinkBotao href="/app" grande>
            Abrir meu painel
          </LinkBotao>
        </>
      )}
      {estado === 'erro' && (
        <>
          <CircleAlert aria-hidden className="size-10 text-perigo-texto" />
          <h1 className="text-3xl font-semibold">Não deu para confirmar</h1>
          <p className="text-tinta-suave">{mensagem}</p>
          <p className="text-tinta-suave">
            Entre no painel e toque em &quot;Reenviar e-mail&quot; no aviso do topo para receber um
            link novo.
          </p>
          <LinkBotao href="/entrar" grande>
            Entrar
          </LinkBotao>
        </>
      )}
    </main>
  );
}

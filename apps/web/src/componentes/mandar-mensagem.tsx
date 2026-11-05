'use client';

import { linkWhatsapp } from '@pente-fino/shared';
import { Botao, CampoTexto, Dialogo } from '@pente-fino/ui';
import { Bot, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaveConversas, chavesOperacao, useAcao, useEnvioParaCliente } from '@/lib/consultas';
import { Aviso } from './aviso';

/**
 * Mensagem para um cliente com o texto pronto (editável) e duas saídas: pelo número da
 * barbearia, quando o bot pode (o cliente já escreveu, não pediu SAIR, WhatsApp conectado),
 * ou pelo WhatsApp de quem está usando o painel, pelo link.
 */
export function MandarMensagem({
  aberto,
  onFechar,
  clienteId,
  nome,
  telefone,
  textoInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  clienteId: string;
  nome: string;
  telefone: string | null;
  textoInicial: string;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<string | null>(null);
  const envio = useEnvioParaCliente(clienteId, aberto);
  const enviar = useAcao(
    (t: string) =>
      api<{ id: string; conversaId: string }>(`conversas/cliente/${clienteId}`, {
        corpo: { texto: t, unidadeId: envio.data?.unidadeId ?? undefined },
      }),
    [chaveConversas, chavesOperacao.clientes],
  );
  const link = linkWhatsapp(telefone, texto);

  function fechar() {
    setTexto(textoInicial);
    setErro(null);
    setEnviada(null);
    onFechar();
  }

  return (
    <Dialogo aberto={aberto} titulo={`Mensagem para ${nome}`} onFechar={fechar}>
      {enviada ? (
        <div className="flex flex-col gap-4">
          <Aviso tom="sucesso">
            Mensagem na fila do WhatsApp da barbearia. A resposta do cliente aparece em Conversas.
          </Aviso>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/conversas"
              className="inline-flex min-h-11 items-center rounded-md px-4 font-semibold text-acao-texto underline"
            >
              Abrir Conversas
            </Link>
            <Botao variante="secundario" onClick={fechar}>
              Concluir
            </Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {erro && <Aviso tom="erro">{erro}</Aviso>}
          <CampoTexto
            id="mandar-texto"
            rotulo="Mensagem"
            rows={4}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {envio.data && !envio.data.podeBot && envio.data.motivo && (
            <Aviso tom="info">{envio.data.motivo}</Aviso>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={fechar}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-borda bg-superficie-2 px-4 font-semibold text-tinta hover:bg-superficie-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
              >
                <MessageCircle aria-hidden className="size-5" /> Abrir no meu WhatsApp
              </a>
            ) : (
              <p className="text-sm text-tinta-suave">Sem telefone válido para abrir o WhatsApp.</p>
            )}
            <Botao
              disabled={!envio.data?.podeBot || !texto.trim()}
              carregando={envio.isPending || enviar.isPending}
              onClick={async () => {
                setErro(null);
                try {
                  const r = await enviar.mutateAsync(texto.trim());
                  setEnviada(r.id);
                } catch (e) {
                  setErro(
                    e instanceof ErroApi ? e.message : 'Não foi possível enviar. Tente de novo.',
                  );
                }
              }}
            >
              <Bot aria-hidden className="size-5" />
              {envio.data?.unidade
                ? `Enviar pelo WhatsApp da ${envio.data.unidade}`
                : 'Enviar pelo WhatsApp da barbearia'}
            </Botao>
          </div>
        </div>
      )}
    </Dialogo>
  );
}

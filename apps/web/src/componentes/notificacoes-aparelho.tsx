'use client';

import type { EstadoPush } from '@pente-fino/shared';
import { Botao } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao } from '@/lib/consultas';
import { inscreverAparelho, motivoDoErroPush, pushSuportado } from '@/lib/push';
import { Aviso } from './aviso';

const chave = ['me', 'push'] as const;

const suportado = pushSuportado;

const PERGUNTADO = 'pf-push-perguntado';
const lerPerguntado = () => {
  try {
    return localStorage.getItem(PERGUNTADO) === '1';
  } catch {
    return false;
  }
};
const marcarPerguntado = () => {
  try {
    localStorage.setItem(PERGUNTADO, '1');
  } catch {
    // Sem armazenamento (aba anônima): pode perguntar de novo no próximo clique.
  }
};

/**
 * Notificações deste aparelho (push do PWA): estado, ligar (pede a permissão do navegador e
 * inscreve) e desligar. Usado no Perfil, no sino e na tela de Avisos.
 */
export function usePushAparelho() {
  const estado = useQuery({ queryKey: chave, queryFn: () => api<EstadoPush>('me/push') });
  const [inscrito, setInscrito] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Só afeta o que aparece depois de saber se está inscrito (efeito abaixo), então não muda o HTML
  // do servidor.
  const [permissao, setPermissao] = useState<NotificationPermission | null>(() =>
    suportado() ? Notification.permission : null,
  );

  useEffect(() => {
    if (!suportado()) return;
    void navigator.serviceWorker
      .getRegistration('/')
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => setInscrito(!!s))
      .catch(() => setInscrito(false));
  }, []);

  const chavePublica = estado.data?.chavePublica ?? null;

  async function ligar(): Promise<boolean> {
    if (!chavePublica || !suportado()) return false;
    setErro(null);
    setOcupado(true);
    marcarPerguntado();
    try {
      const s = await inscreverAparelho(chavePublica);
      await api('me/push', { corpo: s.toJSON() });
      setInscrito(true);
      void estado.refetch();
      return true;
    } catch (e) {
      // O motivo de verdade (antes, sempre "Não foi possível ligar"): pedido de 20/11/2026.
      setErro(e instanceof ErroApi ? e.message : motivoDoErroPush(e));
      return false;
    } finally {
      setPermissao(suportado() ? Notification.permission : null);
      setOcupado(false);
    }
  }

  async function desligar() {
    setErro(null);
    setOcupado(true);
    try {
      const s = await (
        await navigator.serviceWorker.getRegistration('/')
      )?.pushManager.getSubscription();
      if (s) {
        await api('me/push/remover', { corpo: { endpoint: s.endpoint } });
        await s.unsubscribe();
      }
      setInscrito(false);
      void estado.refetch();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível desligar.');
    } finally {
      setOcupado(false);
    }
  }

  return {
    /** O servidor tem push ligado e o navegador suporta. */
    disponivel: !!chavePublica && suportado(),
    suportado: suportado(),
    chavePublica,
    inscrito,
    permissao,
    erro,
    ocupado,
    ligar,
    desligar,
    /** Ainda não perguntou neste aparelho e o navegador deixa perguntar. */
    podePerguntar: !!chavePublica && suportado() && permissao === 'default' && inscrito === false,
    jaPerguntou: lerPerguntado,
  };
}

/**
 * Tela de Avisos: convite para ligar as notificações neste aparelho, enquanto não estiverem
 * ligadas. Bloqueadas no navegador: mostra como liberar.
 */
export function ConviteNotificacoes() {
  const push = usePushAparelho();
  if (!push.disponivel || push.inscrito !== false) return null;
  const bloqueado = push.permissao === 'denied';
  return (
    <section
      aria-labelledby="titulo-convite-push"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-borda-forte bg-superficie p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-acao-texto" />
        <div className="flex flex-col gap-1">
          <h2 id="titulo-convite-push" className="font-semibold">
            Ative as notificações neste aparelho
          </h2>
          <p className="text-sm text-tinta-suave">
            {bloqueado
              ? 'O navegador está bloqueando. Toque no cadeado ao lado do endereço, libere "Notificações" e recarregue a página.'
              : 'Saiba na hora quando entra, muda ou cai um horário, mesmo com o app fechado.'}
          </p>
          {push.erro && !bloqueado && <p className="text-sm text-perigo-texto">{push.erro}</p>}
        </div>
      </div>
      {!bloqueado && (
        <Botao carregando={push.ocupado} onClick={() => void push.ligar()}>
          Ativar notificações
        </Botao>
      )}
    </section>
  );
}

/**
 * Perfil → Notificações neste aparelho: horários novos, remarcados e cancelados da agenda
 * chegam como notificação, mesmo com o app fechado. Cada aparelho liga o seu.
 */
export function NotificacoesAparelho() {
  const push = usePushAparelho();
  const { inscrito, erro, ocupado, ligar, desligar } = push;
  const [testou, setTestou] = useState<string | null>(null);
  const teste = useAcao(
    () => api<{ ok: true; aparelhos: number }>('me/push/teste', { corpo: {} }),
    [],
  );
  if (!push.chavePublica) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-notificacoes">
      <h2
        id="titulo-notificacoes"
        className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
      >
        Notificações neste aparelho
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <p className="text-tinta-suave">
          Receba aqui os horários novos, remarcados e cancelados da sua agenda, mesmo com o app
          fechado. Só perto do seu expediente.
        </p>
        {!suportado() ? (
          <Aviso tom="info">
            Este navegador não recebe notificações. No iPhone, adicione o app à tela de início e
            abra por lá.
          </Aviso>
        ) : inscrito ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <Bell aria-hidden className="size-5 text-acao-texto" /> Ligadas neste aparelho
            </p>
            {testou && (
              <p className="text-sm text-tinta-suave" role="status">
                {testou}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Botao
                variante="secundario"
                carregando={teste.isPending}
                onClick={async () => {
                  try {
                    const r = await teste.mutateAsync(undefined);
                    setTestou(
                      `Teste enviado para ${r.aparelhos} ${r.aparelhos === 1 ? 'aparelho' : 'aparelhos'}. Deve chegar em instantes; se não chegar, desligue e ligue de novo neste aparelho.`,
                    );
                  } catch (e) {
                    setTestou(
                      e instanceof ErroApi
                        ? e.message
                        : 'Não deu para mandar o teste. Tente de novo.',
                    );
                  }
                }}
              >
                Mandar um teste
              </Botao>
              <Botao
                variante="fantasma"
                carregando={ocupado}
                onClick={() => {
                  setTestou(null);
                  void desligar();
                }}
              >
                Desligar neste aparelho
              </Botao>
            </div>
          </>
        ) : (
          <Botao className="self-start" carregando={ocupado} onClick={() => void ligar()}>
            <Bell aria-hidden className="size-5" /> Ligar notificações
          </Botao>
        )}
      </div>
    </section>
  );
}

'use client';

import {
  AVISOS_EQUIPE,
  AVISOS_GESTAO,
  formatarHora,
  formatarTelefone,
  NOME_AVISO_EQUIPE,
  type AvisoEquipe,
  type CodigoAssistente,
  type EstadoAssistente,
} from '@pente-fino/shared';
import { Botao, Marcador } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { useAcao } from '@/lib/consultas';
import { Aviso } from './aviso';

const chave = ['me', 'assistente'] as const;
const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';

/**
 * Perfil → Assistente no WhatsApp: o profissional liga mandando um código para o WhatsApp da
 * barbearia, pergunta a agenda e a comissão por lá e recebe os avisos da agenda dele.
 */
export function AssistenteEquipe() {
  const estado = useQuery({
    queryKey: chave,
    queryFn: () => api<EstadoAssistente>('me/assistente'),
    retry: false,
    // Esperando o código chegar: confere sozinho.
    refetchInterval: (q) => (q.state.data?.situacao === 'aguardando' ? 5_000 : false),
  });
  const [codigo, setCodigo] = useState<CodigoAssistente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ligar = useAcao(() => api<CodigoAssistente>('me/assistente', { corpo: {} }), [chave]);
  const desligar = useAcao(() => api('me/assistente', { metodo: 'DELETE' }), [chave]);
  const avisos = useAcao(
    (corpo: object) => api('me/assistente/avisos', { metodo: 'PUT', corpo }),
    [chave],
  );
  // Recepção fora da agenda não tem assistente.
  if (estado.isError || !estado.data) return null;
  const e = estado.data;
  // Resposta antiga da API, sem a lista: mostra tudo como antes.
  const disponiveis: readonly AvisoEquipe[] =
    (e.disponiveis as AvisoEquipe[] | undefined) ?? AVISOS_EQUIPE;
  const atende = disponiveis.some((k) => !AVISOS_GESTAO.includes(k));
  const gere = disponiveis.some((k) => AVISOS_GESTAO.includes(k));
  const comandos = [
    ...(atende ? ['AGENDA', 'AMANHÃ', 'COMISSÃO'] : []),
    ...(gere ? ['RESUMO'] : []),
  ];

  const acao = async (fn: () => Promise<unknown>) => {
    setErro(null);
    try {
      await fn();
    } catch (er) {
      setErro(mensagemDe(er));
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-assistente">
      <h2
        id="titulo-assistente"
        className="text-xs font-semibold uppercase tracking-wider text-tinta-suave"
      >
        Assistente no WhatsApp
      </h2>
      <div className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-4">
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {e.situacao === 'ligado' || e.situacao === 'pausado' ? (
          <>
            <p>
              Ligado no número <strong>{e.telefone ? formatarTelefone(e.telefone) : '—'}</strong>
              {e.situacao === 'pausado' && ' · avisos pausados (responda LIGAR no WhatsApp)'}.
            </p>
            <p className="text-sm text-tinta-suave">
              Mande {comandos.slice(0, -1).join(', ')}
              {comandos.length > 1 ? ' ou ' : ''}
              {comandos.at(-1)} para o WhatsApp da barbearia. PARAR pausa os avisos.
            </p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Avisos que quero receber</legend>
              {disponiveis.map((k) => (
                <Marcador
                  key={k}
                  id={`aviso-equipe-${k}`}
                  rotulo={NOME_AVISO_EQUIPE[k]}
                  checked={e.avisos[k]}
                  disabled={avisos.isPending}
                  onChange={(ev) => acao(() => avisos.mutateAsync({ [k]: ev.target.checked }))}
                />
              ))}
              <p className="text-sm text-tinta-suave">
                {atende
                  ? 'Os avisos da agenda só saem perto do seu expediente, nunca de madrugada.'
                  : 'O resumo sai no fim do expediente da unidade.'}
              </p>
            </fieldset>
            <Botao
              variante="secundario"
              className="self-start"
              carregando={desligar.isPending}
              onClick={() => acao(() => desligar.mutateAsync(undefined))}
            >
              Desligar o assistente
            </Botao>
          </>
        ) : (
          <>
            <p className="text-tinta-suave">
              {atende
                ? `Receba no seu WhatsApp os horários novos, remarcados e cancelados da sua agenda, e pergunte a agenda do dia e a comissão do mês pelo número da ${e.unidade}.`
                : `Receba no seu WhatsApp as faltas, as notas baixas e o resumo do dia, pelo número da ${e.unidade}.`}
              {atende &&
                gere &&
                ' Como gestor, também recebe faltas, notas baixas e o resumo da unidade.'}
            </p>
            {!e.whatsappConectado && (
              <Aviso tom="aviso">
                O WhatsApp da unidade não está conectado. Peça ao dono para conectar em Bot →
                Conexão.
              </Aviso>
            )}
            {codigo ? (
              <div className="flex flex-col gap-3">
                <p>
                  Mande esta mensagem do <strong>seu</strong> WhatsApp para o número da barbearia
                  {e.numeroBarbearia && ` (${formatarTelefone(e.numeroBarbearia)})`}:
                </p>
                <p className="font-denso text-2xl font-bold tracking-widest">
                  ATIVAR {codigo.codigo}
                </p>
                <p className="text-sm text-tinta-suave">
                  Vale até {formatarHora(codigo.expiraEm)}. Esta tela atualiza sozinha quando
                  chegar.
                </p>
                {codigo.link && (
                  <a
                    href={codigo.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 self-start rounded-md bg-acao px-4 font-semibold text-sobre-acao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
                  >
                    <MessageCircle aria-hidden className="size-5" /> Abrir o WhatsApp com a mensagem
                  </a>
                )}
              </div>
            ) : (
              <Botao
                className="self-start"
                disabled={!e.whatsappConectado}
                carregando={ligar.isPending}
                onClick={() => acao(async () => setCodigo(await ligar.mutateAsync(undefined)))}
              >
                {e.situacao === 'aguardando' ? 'Gerar outro código' : 'Ligar o assistente'}
              </Botao>
            )}
          </>
        )}
      </div>
    </section>
  );
}

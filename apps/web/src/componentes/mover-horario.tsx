'use client';

import {
  dataLocal,
  DESFAZER_MOVER_S,
  formatarHora,
  rotuloDoDia,
  textoConfirmarMovimento,
  type ComandaDetalhe,
} from '@pente-fino/shared';
import { Botao, Campo, Dialogo, ModalConfirmacao, Selecao } from '@pente-fino/ui';
import { useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { INVALIDAR_OPERACAO, useAcao, useLivres } from '@/lib/consultas';
import { Aviso } from './aviso';

export interface Movimento {
  agendamentoId: string;
  servicos: readonly string[];
  cliente: string | null;
  de: { inicio: string; profissionalId: string; profissional: string };
  para: { inicio: string; profissionalId: string; profissional: string };
}

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? (e.campos[0]?.mensagem ?? e.message) : 'Não foi possível mover.';

/**
 * Mover um horário (arrastando na agenda ou pelo botão "Mover" da comanda): confirmação curta,
 * grava, e deixa "Desfazer" por alguns segundos. O aviso ao cliente só sai depois desse tempo.
 */
export function useMoverHorario(aoMover?: (c: ComandaDetalhe) => void) {
  const [pendente, setPendente] = useState<Movimento | null>(null);
  const [avisar, setAvisar] = useState(false);
  const [feito, setFeito] = useState<Movimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const gravar = useAcao(
    (d: {
      agendamentoId: string;
      inicio: string;
      profissionalId: string;
      avisarCliente?: boolean;
    }) =>
      api<ComandaDetalhe>(`agendamentos/${d.agendamentoId}`, {
        metodo: 'PATCH',
        corpo: {
          inicio: d.inicio,
          profissionalId: d.profissionalId,
          ...(d.avisarCliente === undefined ? {} : { avisarCliente: d.avisarCliente }),
        },
      }),
    INVALIDAR_OPERACAO,
  );

  useEffect(() => {
    if (!feito) return;
    const t = setTimeout(() => setFeito(null), DESFAZER_MOVER_S * 1000);
    return () => clearTimeout(t);
  }, [feito]);

  const mudouHorario = pendente ? pendente.de.inicio !== pendente.para.inicio : false;
  const hoje = dataLocal(new Date());
  const outroDia =
    pendente &&
    dataLocal(new Date(pendente.de.inicio)) !== dataLocal(new Date(pendente.para.inicio));

  async function confirmar() {
    const m = pendente;
    if (!m) return;
    setErro(null);
    try {
      const c = await gravar.mutateAsync({
        agendamentoId: m.agendamentoId,
        inicio: m.para.inicio,
        profissionalId: m.para.profissionalId,
        ...(mudouHorario ? {} : { avisarCliente: avisar }),
      });
      setPendente(null);
      setFeito(m);
      aoMover?.(c);
    } catch (e) {
      setPendente(null);
      setErro(mensagemDe(e));
    }
  }

  async function desfazer() {
    const m = feito;
    if (!m) return;
    setFeito(null);
    try {
      const c = await gravar.mutateAsync({
        agendamentoId: m.agendamentoId,
        inicio: m.de.inicio,
        profissionalId: m.de.profissionalId,
        avisarCliente: false,
      });
      aoMover?.(c);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

  const elementos = (
    <>
      {erro && (
        <Aviso tom="erro">
          <span className="font-semibold">Não deu para mover:</span> {erro}
        </Aviso>
      )}
      {feito && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-borda-forte bg-superficie-2 p-3 shadow-lg"
        >
          <p className="text-sm">
            Horário movido para {formatarHora(feito.para.inicio)}
            {feito.para.profissionalId !== feito.de.profissionalId
              ? ` com ${feito.para.profissional.trim().split(/\s+/)[0]}`
              : ''}
            .
          </p>
          <Botao variante="secundario" onClick={desfazer} carregando={gravar.isPending}>
            Desfazer
          </Botao>
        </div>
      )}
      <ModalConfirmacao
        aberto={!!pendente}
        titulo="Mover horário"
        descricao={
          pendente && (
            <span className="flex flex-col gap-3">
              <span>
                {textoConfirmarMovimento({
                  servico: `o horário de ${pendente.servicos.join(' + ') || 'serviço'}`,
                  cliente: pendente.cliente,
                  de: pendente.de,
                  para: {
                    ...pendente.para,
                    diaRotulo: outroDia
                      ? rotuloDoDia(dataLocal(new Date(pendente.para.inicio)), hoje)
                      : null,
                  },
                })}
              </span>
              {mudouHorario ? (
                <span className="text-sm text-tinta-suave">
                  O cliente recebe o aviso pelo WhatsApp, se aceita mensagens.
                </span>
              ) : (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={avisar}
                    onChange={(e) => setAvisar(e.target.checked)}
                    className="size-5 accent-[var(--modulo)]"
                  />
                  Avisar o cliente da troca de barbeiro
                </label>
              )}
            </span>
          )
        }
        textoConfirmar="Mover"
        carregando={gravar.isPending}
        onConfirmar={confirmar}
        onCancelar={() => setPendente(null)}
      />
    </>
  );

  return {
    pedir: (m: Movimento) => {
      setErro(null);
      setAvisar(false);
      setPendente(m);
    },
    elementos,
  };
}

/**
 * "Mover" da comanda (celular e teclado): escolhe barbeiro, dia e um horário livre; depois a
 * mesma confirmação do arrastar.
 */
export function MoverComanda({
  c,
  profissionais,
  aberto,
  onFechar,
  onEscolher,
}: {
  c: ComandaDetalhe;
  profissionais: readonly { id: string; nome: string }[];
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (m: Movimento) => void;
}) {
  const [profissionalId, setProfissionalId] = useState(c.profissionalId);
  const [dia, setDia] = useState(c.inicio ? dataLocal(new Date(c.inicio)) : dataLocal(new Date()));
  const duracao =
    c.inicio && c.fim ? Math.round((Date.parse(c.fim) - Date.parse(c.inicio)) / 60_000) : 0;
  const livres = useLivres(aberto ? c.unidadeId : null, dia, duracao, profissionalId);
  const inicios = (livres.data ?? []).flatMap((l) => l.inicios);
  const nome = (id: string) => profissionais.find((p) => p.id === id)?.nome ?? '';

  return (
    <Dialogo
      aberto={aberto}
      titulo="Mover horário"
      descricao="Escolha o barbeiro, o dia e um horário livre. A comanda prevista vai junto."
      onFechar={onFechar}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            id="mover-prof"
            rotulo="Barbeiro"
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            opcoes={profissionais.map((p) => ({ valor: p.id, rotulo: p.nome }))}
          />
          <Campo
            id="mover-dia"
            rotulo="Dia"
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
        </div>
        {livres.isPending ? (
          <p className="text-tinta-suave">Procurando horários…</p>
        ) : inicios.length === 0 ? (
          <p className="text-tinta-suave">Nenhum horário livre. Tente outro dia ou barbeiro.</p>
        ) : (
          <fieldset className="min-w-0">
            <legend className="mb-1 text-sm font-medium">Horários livres</legend>
            <div className="flex flex-wrap gap-2">
              {inicios.map((inicio) => (
                <button
                  key={inicio}
                  type="button"
                  onClick={() => {
                    onFechar();
                    onEscolher({
                      agendamentoId: c.agendamentoId!,
                      servicos: c.servicos,
                      cliente: c.cliente,
                      de: {
                        inicio: c.inicio!,
                        profissionalId: c.profissionalId,
                        profissional: c.profissional,
                      },
                      para: { inicio, profissionalId, profissional: nome(profissionalId) },
                    });
                  }}
                  className="min-h-11 min-w-16 rounded-md border border-borda px-3 font-denso text-base font-semibold tabular-nums hover:border-borda-forte focus-visible:outline-2 focus-visible:outline-foco"
                >
                  {formatarHora(inicio)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </Dialogo>
  );
}

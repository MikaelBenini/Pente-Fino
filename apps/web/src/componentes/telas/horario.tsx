'use client';

import {
  dataLocal,
  formatarDiaPorExtenso,
  formatarHora,
  formatarMoeda,
  NOMES_DIAS_CURTOS,
  type HorarioDoLink,
  type HorarioLivre,
} from '@pente-fino/shared';
import { Botao, Carregando, cn, EstadoVazio } from '@pente-fino/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarX, CircleCheck, MessageCircle, SearchX } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { Aviso } from '../aviso';
import { chip, Moldura, proximosDias } from './agendar';

const mensagemDe = (e: unknown) =>
  e instanceof ErroApi ? e.message : 'Não foi possível concluir. Tente de novo.';

const NOME_SITUACAO: Record<HorarioDoLink['situacao'], string> = {
  marcado: 'Horário marcado',
  confirmado: 'Horário confirmado',
  cancelado: 'Horário cancelado',
  passou: 'Este horário já passou',
  atendido: 'Atendimento feito',
};

/** /horario?t=token: o cliente vê o próprio horário e remarca ou cancela, sem login. */
export function TelaHorario() {
  const token = useSearchParams().get('t') ?? '';
  const chave = ['publico', 'horario', token] as const;
  const qc = useQueryClient();
  const valido = /^[A-Za-z0-9_-]{20,40}$/.test(token);
  const h = useQuery({
    queryKey: chave,
    queryFn: () => api<HorarioDoLink>(`publico/horario/${token}`),
    enabled: valido,
    retry: false,
  });
  const [modo, setModo] = useState<'ver' | 'remarcar' | 'cancelar'>('ver');
  const [aviso, setAviso] = useState<string | null>(null);

  if (!valido || h.isError)
    return (
      <Moldura>
        <EstadoVazio
          icone={SearchX}
          titulo="Link não encontrado"
          texto="Ele pode ter sido trocado por um mais novo. Confira a última mensagem da barbearia."
        />
      </Moldura>
    );
  if (h.isPending)
    return (
      <Moldura>
        <Carregando />
      </Moldura>
    );
  const d = h.data;
  const atualizar = (novo: HorarioDoLink, texto: string) => {
    qc.setQueryData(chave, novo);
    setModo('ver');
    setAviso(texto);
  };
  const ativo = d.situacao === 'marcado' || d.situacao === 'confirmado';

  return (
    <Moldura u={{ nome: d.unidade, barbearia: d.barbearia, endereco: d.endereco }}>
      {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
      <section
        className={cn(
          'flex flex-col gap-3 rounded-lg border bg-superficie p-5',
          ativo ? 'border-2 border-acao' : 'border-borda',
        )}
        aria-labelledby="titulo-horario"
      >
        {ativo ? (
          <CircleCheck aria-hidden className="size-10 text-acao-texto" strokeWidth={1.75} />
        ) : (
          <CalendarX aria-hidden className="size-10 text-tinta-suave" strokeWidth={1.75} />
        )}
        <h2 id="titulo-horario" className="text-2xl font-semibold">
          {NOME_SITUACAO[d.situacao]}
        </h2>
        <p
          className={cn(
            'text-lg first-letter:uppercase',
            !ativo && 'text-tinta-suave line-through',
          )}
        >
          {formatarDiaPorExtenso(d.inicio)}, às{' '}
          <strong className="font-denso tabular-nums">{formatarHora(d.inicio)}</strong>, com{' '}
          {d.profissional}
        </p>
        <p className="text-tinta-suave">
          {d.servicos.join(' + ')} · {formatarMoeda(d.total)}
        </p>
        {d.motivo && ativo && <p className="text-sm text-tinta-suave">{d.motivo}</p>}
      </section>

      {d.podeMudar && modo === 'ver' && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Botao className="min-h-12 flex-1 text-lg" onClick={() => setModo('remarcar')}>
            Remarcar
          </Botao>
          <Botao
            variante="secundario"
            className="min-h-12 flex-1 text-lg"
            onClick={() => setModo('cancelar')}
          >
            Cancelar horário
          </Botao>
        </div>
      )}
      {d.podeMudar && modo === 'remarcar' && (
        <Remarcar
          token={token}
          d={d}
          onFeito={(novo) => atualizar(novo, 'Pronto, horário remarcado.')}
          onVoltar={() => setModo('ver')}
        />
      )}
      {d.podeMudar && modo === 'cancelar' && (
        <Cancelar
          token={token}
          onFeito={(novo) =>
            atualizar(novo, 'Horário cancelado. Quando quiser, é só marcar de novo.')
          }
          onVoltar={() => setModo('ver')}
        />
      )}

      {d.linkWhatsapp && (
        <a
          href={d.linkWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start font-semibold text-modulo-texto underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          <MessageCircle aria-hidden className="size-5" /> Falar com a barbearia
        </a>
      )}
    </Moldura>
  );
}

function Remarcar({
  token,
  d,
  onFeito,
  onVoltar,
}: {
  token: string;
  d: HorarioDoLink;
  onFeito: (novo: HorarioDoLink) => void;
  onVoltar: () => void;
}) {
  const dias = useMemo(() => proximosDias(Math.min(14, d.janelaDias + 1)), [d.janelaDias]);
  const [dia, setDia] = useState(dataLocal(new Date()));
  const [inicio, setInicio] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const livres = useQuery({
    queryKey: ['publico', 'horario', token, 'livres', dia],
    queryFn: () => api<HorarioLivre[]>(`publico/horario/${token}/horarios?data=${dia}`),
  });
  const inicios = (livres.data ?? []).flatMap((l) => l.inicios).filter((i) => i !== d.inicio);

  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!inicio) return;
        setErro(null);
        setEnviando(true);
        try {
          onFeito(
            await api<HorarioDoLink>(`publico/horario/${token}/remarcar`, { corpo: { inicio } }),
          );
        } catch (er) {
          setErro(mensagemDe(er));
          setInicio(null);
          void livres.refetch();
        } finally {
          setEnviando(false);
        }
      }}
    >
      <fieldset className="min-w-0">
        <legend className="mb-1 text-lg font-semibold">Novo horário</legend>
        <p className="mb-3 text-sm text-tinta-suave">
          {d.servicos.join(' + ')} com {d.profissional}.
        </p>
        <div className="flex flex-col gap-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {dias.map((x) => {
              const data = new Date(`${x}T12:00:00Z`);
              return (
                <button
                  key={x}
                  type="button"
                  aria-pressed={dia === x}
                  aria-label={formatarDiaPorExtenso(`${x}T12:00:00Z`)}
                  className={cn(
                    chip(dia === x),
                    'flex min-w-14 shrink-0 flex-col items-center py-1 leading-tight',
                  )}
                  onClick={() => {
                    setDia(x);
                    setInicio(null);
                  }}
                >
                  <span className="text-xs uppercase">{NOMES_DIAS_CURTOS[data.getUTCDay()]}</span>
                  <span className="font-denso text-xl tabular-nums">{data.getUTCDate()}</span>
                </button>
              );
            })}
          </div>
          {livres.isPending ? (
            <p className="text-tinta-suave">Procurando horários…</p>
          ) : livres.isError ? (
            <Aviso tom="erro">{mensagemDe(livres.error)}</Aviso>
          ) : inicios.length === 0 ? (
            <p className="flex items-center gap-2 text-tinta-suave">
              <CalendarCheck aria-hidden className="size-5" /> Sem horário livre com{' '}
              {d.profissional} neste dia. Tente outro dia.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Horários livres">
              {inicios.map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={inicio === i}
                  className={cn(chip(inicio === i), 'min-w-18 font-denso text-lg tabular-nums')}
                  onClick={() => setInicio(i)}
                >
                  {formatarHora(i)}
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Botao
          type="submit"
          className="min-h-12 flex-1 text-lg"
          carregando={enviando}
          disabled={!inicio}
        >
          {inicio ? `Remarcar para ${formatarHora(inicio)}` : 'Escolha o horário'}
        </Botao>
        <Botao type="button" variante="secundario" className="min-h-12" onClick={onVoltar}>
          Voltar
        </Botao>
      </div>
    </form>
  );
}

function Cancelar({
  token,
  onFeito,
  onVoltar,
}: {
  token: string;
  onFeito: (novo: HorarioDoLink) => void;
  onVoltar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-borda bg-superficie p-5">
      <h3 className="text-lg font-semibold">Cancelar este horário?</h3>
      <p className="text-tinta-suave">O horário fica livre para outra pessoa.</p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Botao
          variante="perigo"
          className="min-h-12 flex-1 text-lg"
          carregando={enviando}
          onClick={async () => {
            setErro(null);
            setEnviando(true);
            try {
              onFeito(await api<HorarioDoLink>(`publico/horario/${token}/cancelar`, { corpo: {} }));
            } catch (er) {
              setErro(mensagemDe(er));
            } finally {
              setEnviando(false);
            }
          }}
        >
          Sim, cancelar
        </Botao>
        <Botao variante="secundario" className="min-h-12 flex-1" onClick={onVoltar}>
          Não, manter
        </Botao>
      </div>
    </section>
  );
}

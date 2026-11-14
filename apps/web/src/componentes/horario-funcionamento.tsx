'use client';

// Horário de funcionamento da unidade (pedido do dono em 13/11), em Configurações, Unidades. Por
// dia: abre, fecha e um intervalo opcional (almoço). O agendamento só oferece horário dentro dele,
// mesmo que o barbeiro tenha expediente maior; o site mostra esse horário.
import {
  horarioFuncionamentoSchema,
  type HorarioFuncionamento,
  type TurnoFuncionamento,
} from '@pente-fino/shared';
import { Botao, Dialogo } from '@pente-fino/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { chaves, useAcao } from '@/lib/consultas';
import { Aviso } from './aviso';
import { Estado } from './pagina';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

interface Dia {
  abre: boolean;
  inicio: string;
  fim: string;
  almoco: boolean;
  almocoInicio: string;
  almocoFim: string;
}

const paraHora = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const paraMin = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function diasDosTurnos(turnos: TurnoFuncionamento[]): Dia[] {
  return Array.from({ length: 7 }, (_, d) => {
    const doDia = turnos.filter((t) => t.diaSemana === d).sort((a, b) => a.inicioMin - b.inicioMin);
    const [t1, t2] = doDia;
    return {
      abre: doDia.length > 0,
      inicio: paraHora(t1?.inicioMin ?? 540),
      fim: paraHora((t2 ?? t1)?.fimMin ?? 1200),
      almoco: doDia.length > 1,
      almocoInicio: paraHora(t1 && t2 ? t1.fimMin : 720),
      almocoFim: paraHora(t2?.inicioMin ?? 780),
    };
  });
}

function turnosDosDias(dias: Dia[]): TurnoFuncionamento[] {
  return dias.flatMap((d, diaSemana) => {
    if (!d.abre) return [];
    if (!d.almoco) return [{ diaSemana, inicioMin: paraMin(d.inicio), fimMin: paraMin(d.fim) }];
    return [
      { diaSemana, inicioMin: paraMin(d.inicio), fimMin: paraMin(d.almocoInicio) },
      { diaSemana, inicioMin: paraMin(d.almocoFim), fimMin: paraMin(d.fim) },
    ];
  });
}

export function HorarioFuncionamentoDialogo({
  unidadeId,
  nome,
  onFechar,
}: {
  unidadeId: string;
  nome: string;
  onFechar: () => void;
}) {
  const consulta = useQuery({
    queryKey: ['unidades', unidadeId, 'funcionamento'],
    queryFn: () => api<HorarioFuncionamento>(`unidades/${unidadeId}/funcionamento`),
  });
  return (
    <Dialogo
      aberto
      titulo={`Horário de funcionamento: ${nome}`}
      onFechar={onFechar}
      largura="larga"
    >
      <Estado consulta={consulta}>
        {() => (
          <Formulario unidadeId={unidadeId} inicial={consulta.data!.turnos} onFechar={onFechar} />
        )}
      </Estado>
    </Dialogo>
  );
}

function Formulario({
  unidadeId,
  inicial,
  onFechar,
}: {
  unidadeId: string;
  inicial: TurnoFuncionamento[];
  onFechar: () => void;
}) {
  const [dias, setDias] = useState<Dia[]>(() => diasDosTurnos(inicial));
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useAcao(
    (turnos: TurnoFuncionamento[]) =>
      api(`unidades/${unidadeId}/funcionamento`, { metodo: 'PUT', corpo: { turnos } }),
    [chaves.unidades],
  );
  const mudar = (d: number, m: Partial<Dia>) => {
    setErro(null);
    setDias(dias.map((x, i) => (i === d ? { ...x, ...m } : x)));
  };

  async function enviar(turnos: TurnoFuncionamento[]) {
    const r = horarioFuncionamentoSchema.safeParse({ turnos });
    if (!r.success) {
      setErro(
        r.error.issues[0]?.message === 'A hora de fechar vem depois da de abrir.'
          ? 'Confira os horários: a hora de fechar (e a volta do almoço) vem depois da de abrir.'
          : (r.error.issues[0]?.message ?? 'Confira os horários.'),
      );
      return;
    }
    try {
      await salvar.mutateAsync(r.data.turnos);
      onFechar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar. Tente de novo.');
    }
  }

  const repetir = (origem: number) =>
    setDias(dias.map((x) => (x.abre ? { ...dias[origem]!, abre: true } : x)));

  return (
    <form
      method="post"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar(turnosDosDias(dias));
      }}
    >
      <p className="text-sm text-tinta-suave">
        O cliente só consegue marcar (pelo link, pelo WhatsApp ou no balcão) dentro deste horário,
        mesmo que o barbeiro trabalhe mais. O site mostra este horário.
      </p>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <ul className="flex flex-col gap-2">
        {ORDEM.map((d) => {
          const dia = dias[d]!;
          return (
            <li key={d} className="flex flex-col gap-2 rounded-md border border-borda p-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex min-h-11 w-32 cursor-pointer items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={dia.abre}
                    onChange={(e) => mudar(d, { abre: e.target.checked })}
                    className="size-5 accent-[var(--color-acao)]"
                  />
                  {DIAS[d]}
                </label>
                {dia.abre ? (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      Abre
                      <input
                        type="time"
                        value={dia.inicio}
                        step={900}
                        onChange={(e) => mudar(d, { inicio: e.target.value })}
                        className="min-h-11 rounded-md border border-borda bg-superficie px-2"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      Fecha
                      <input
                        type="time"
                        value={dia.fim}
                        step={900}
                        onChange={(e) => mudar(d, { fim: e.target.value })}
                        className="min-h-11 rounded-md border border-borda bg-superficie px-2"
                      />
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={dia.almoco}
                        onChange={(e) => mudar(d, { almoco: e.target.checked })}
                        className="size-5 accent-[var(--color-acao)]"
                      />
                      Fecha para almoço
                    </label>
                  </>
                ) : (
                  <span className="text-sm text-tinta-suave">Fechado</span>
                )}
              </div>
              {dia.abre && dia.almoco && (
                <div className="flex flex-wrap items-center gap-4 pl-0 sm:pl-36">
                  <label className="flex items-center gap-2 text-sm">
                    Sai às
                    <input
                      type="time"
                      value={dia.almocoInicio}
                      step={900}
                      onChange={(e) => mudar(d, { almocoInicio: e.target.value })}
                      className="min-h-11 rounded-md border border-borda bg-superficie px-2"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Volta às
                    <input
                      type="time"
                      value={dia.almocoFim}
                      step={900}
                      onChange={(e) => mudar(d, { almocoFim: e.target.value })}
                      className="min-h-11 rounded-md border border-borda bg-superficie px-2"
                    />
                  </label>
                </div>
              )}
              {dia.abre && (
                <Botao
                  variante="fantasma"
                  className="self-start text-sm"
                  onClick={() => repetir(d)}
                >
                  Usar este horário nos outros dias abertos
                </Botao>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Botao variante="fantasma" onClick={() => void enviar([])} disabled={salvar.isPending}>
          Sem horário: usar o expediente da equipe
        </Botao>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Botao variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvar.isPending}>
            Salvar horário
          </Botao>
        </div>
      </div>
    </form>
  );
}

// Ocupação da unidade e mapa da semana (Etapa 14): minutos marcados contra minutos disponíveis,
// hora a hora, respeitando as cadeiras da unidade (capacidade). Regras puras.
import { diaDaSemana, instanteLocal } from './agenda.js';
import type { Ocupacao, Periodo, TurnoSemanal } from './desempenho.js';
import type { DataISO } from './vigencia.js';

const MIN_MS = 60_000;

export type FaixaDoDia = 'manha' | 'tarde' | 'noite';
export const NOME_FAIXA: Readonly<Record<FaixaDoDia, string>> = {
  manha: 'Manhã (até 12h)',
  tarde: 'Tarde (12h às 18h)',
  noite: 'Noite (depois das 18h)',
};
export const faixaDaHora = (hora: number): FaixaDoDia =>
  hora < 12 ? 'manha' : hora < 18 ? 'tarde' : 'noite';

export interface CelulaDoMapa {
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  hora: number;
  disponivelMin: number;
  agendadoMin: number;
  fracao: number;
}

export interface MapaDeOcupacao {
  total: Ocupacao;
  porFaixa: { faixa: FaixaDoDia; ocupacao: Ocupacao }[];
  /** Só as horas com expediente. */
  celulas: CelulaDoMapa[];
}

const sobrepoe = (a: Periodo, b: Periodo) =>
  Math.max(
    0,
    Math.min(a.fim.getTime(), b.fim.getTime()) - Math.max(a.inicio.getTime(), b.inicio.getTime()),
  );

const ocupacao = (disponivelMin: number, agendadoMin: number): Ocupacao => ({
  disponivelMin,
  agendadoMin,
  fracao: disponivelMin ? agendadoMin / disponivelMin : 0,
});

/**
 * Hora a hora, em cada dia de trabalho: disponível = soma do expediente livre de bloqueio de
 * cada profissional, limitada às cadeiras (capacidade × 60 min); marcado = soma dos horários
 * marcados nessa hora, limitada ao disponível. Junta por dia da semana e hora.
 */
export function mapaDeOcupacao(d: {
  dias: readonly DataISO[];
  capacidade: number;
  profissionais: readonly {
    turnos: readonly TurnoSemanal[];
    bloqueios: readonly Periodo[];
    agendados: readonly Periodo[];
  }[];
}): MapaDeOcupacao {
  const celulas = new Map<string, CelulaDoMapa>();
  for (const dia of d.dias) {
    const ds = diaDaSemana(dia);
    for (let hora = 0; hora < 24; hora++) {
      const janela = {
        inicio: instanteLocal(dia, hora * 60),
        fim: instanteLocal(dia, hora * 60 + 60),
      };
      let disponivel = 0;
      let agendado = 0;
      for (const p of d.profissionais) {
        let livre = 0;
        for (const t of p.turnos.filter((x) => x.diaSemana === ds)) {
          const turno = {
            inicio: instanteLocal(dia, t.inicioMin),
            fim: instanteLocal(dia, t.fimMin),
          };
          const dentro = sobrepoe(janela, turno);
          if (!dentro) continue;
          const parte = {
            inicio: new Date(Math.max(janela.inicio.getTime(), turno.inicio.getTime())),
            fim: new Date(Math.min(janela.fim.getTime(), turno.fim.getTime())),
          };
          livre += Math.max(0, dentro - p.bloqueios.reduce((s, b) => s + sobrepoe(parte, b), 0));
        }
        disponivel += livre;
        agendado += Math.min(
          livre,
          p.agendados.reduce((s, a) => s + sobrepoe(janela, a), 0),
        );
      }
      const dispMin = Math.min(Math.round(disponivel / MIN_MS), d.capacidade * 60);
      if (dispMin <= 0) continue;
      const agMin = Math.min(Math.round(agendado / MIN_MS), dispMin);
      const chave = `${ds}-${hora}`;
      const c = celulas.get(chave) ?? {
        diaSemana: ds,
        hora,
        disponivelMin: 0,
        agendadoMin: 0,
        fracao: 0,
      };
      c.disponivelMin += dispMin;
      c.agendadoMin += agMin;
      celulas.set(chave, c);
    }
  }
  const lista = [...celulas.values()]
    .map((c) => ({ ...c, fracao: c.agendadoMin / c.disponivelMin }))
    .sort((a, b) => a.diaSemana - b.diaSemana || a.hora - b.hora);
  const soma = (cs: readonly CelulaDoMapa[]) =>
    ocupacao(
      cs.reduce((s, c) => s + c.disponivelMin, 0),
      cs.reduce((s, c) => s + c.agendadoMin, 0),
    );
  return {
    total: soma(lista),
    porFaixa: (['manha', 'tarde', 'noite'] as const)
      .map((faixa) => ({
        faixa,
        ocupacao: soma(lista.filter((c) => faixaDaHora(c.hora) === faixa)),
      }))
      .filter((f) => f.ocupacao.disponivelMin > 0),
    celulas: lista,
  };
}

/** As horas mais vazias e mais cheias (só com expediente de verdade: pelo menos 2 h no período). */
export function extremosDoMapa(celulas: readonly CelulaDoMapa[], n = 3) {
  const validas = celulas.filter((c) => c.disponivelMin >= 120);
  const ordem = [...validas].sort((a, b) => a.fracao - b.fracao);
  return { maisVazias: ordem.slice(0, n), maisCheias: ordem.slice(-n).reverse() };
}

export interface OcupacaoDaUnidade extends MapaDeOcupacao {
  de: string;
  ate: string;
  capacidade: number;
}

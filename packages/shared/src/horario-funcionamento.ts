// Horário de funcionamento da unidade (pedido do dono em 13/11): a hora em que a unidade abre e
// fecha em cada dia, com um intervalo opcional (almoço). O agendamento (link, bot e balcão) só
// oferece horário dentro dele, mesmo que o barbeiro tenha expediente maior; o site mostra esse
// horário; e os avisos de resumo da barbearia saem no fechamento. Sem turnos cadastrados, vale o
// de antes (o expediente da equipe).
import { z } from 'zod';
import { formatarMinutos, type LinhaHorario } from './site-barbearia.js';

export const turnoFuncionamentoSchema = z
  .object({
    diaSemana: z.number().int().min(0).max(6),
    inicioMin: z.number().int().min(0).max(1439),
    fimMin: z.number().int().min(1).max(1440),
  })
  .refine((t) => t.inicioMin < t.fimMin, { error: 'A hora de fechar vem depois da de abrir.' });
export type TurnoFuncionamento = z.infer<typeof turnoFuncionamentoSchema>;

export const horarioFuncionamentoSchema = z.object({
  turnos: z
    .array(turnoFuncionamentoSchema)
    .max(14)
    .superRefine((turnos, ctx) => {
      for (let dia = 0; dia <= 6; dia++) {
        const doDia = turnos
          .filter((t) => t.diaSemana === dia)
          .sort((a, b) => a.inicioMin - b.inicioMin);
        if (doDia.length > 2)
          ctx.addIssue({ code: 'custom', message: 'No máximo dois turnos por dia.' });
        for (let i = 1; i < doDia.length; i++)
          if (doDia[i]!.inicioMin < doDia[i - 1]!.fimMin)
            ctx.addIssue({ code: 'custom', message: 'Os turnos do mesmo dia se sobrepõem.' });
      }
    }),
});
export type HorarioFuncionamento = z.infer<typeof horarioFuncionamentoSchema>;

/** Turnos guardados, lidos com segurança (vazio quando não há ou está inválido). */
export function lerFuncionamento(valor: unknown): TurnoFuncionamento[] {
  const r = horarioFuncionamentoSchema.safeParse({ turnos: valor });
  return r.success ? r.data.turnos : [];
}

/** Dias em que a unidade abre, pelos turnos (vira o "dias de trabalho" da unidade). */
export function diasQueAbre(turnos: readonly TurnoFuncionamento[]): number[] {
  return [...new Set(turnos.map((t) => t.diaSemana))].sort((a, b) => a - b);
}

/**
 * Expediente do barbeiro dentro do funcionamento da unidade no dia (minutos desde a meia-noite).
 * Sem turnos cadastrados na unidade, não limita nada.
 */
export function limitarAoFuncionamento(
  expediente: readonly { inicioMin: number; fimMin: number }[],
  turnos: readonly TurnoFuncionamento[],
  diaSemana: number,
): { inicioMin: number; fimMin: number }[] {
  if (!turnos.length) return expediente.map((e) => ({ ...e }));
  const daUnidade = turnos.filter((t) => t.diaSemana === diaSemana);
  const r: { inicioMin: number; fimMin: number }[] = [];
  for (const e of expediente)
    for (const u of daUnidade) {
      const inicioMin = Math.max(e.inicioMin, u.inicioMin);
      const fimMin = Math.min(e.fimMin, u.fimMin);
      if (inicioMin < fimMin) r.push({ inicioMin, fimMin });
    }
  return r.sort((a, b) => a.inicioMin - b.inicioMin);
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/** "Terça a sexta, 9h às 12h e 13h às 20h" / "Domingo e segunda, fechado", pelos turnos. */
export function linhasDoFuncionamento(turnos: readonly TurnoFuncionamento[]): LinhaHorario[] {
  const porDia = ORDEM_SEMANA.map((dia) => {
    const doDia = turnos
      .filter((t) => t.diaSemana === dia)
      .sort((a, b) => a.inicioMin - b.inicioMin)
      .map((t) => `${formatarMinutos(t.inicioMin)} às ${formatarMinutos(t.fimMin)}`);
    return { dia, horario: doDia.length ? doDia.join(' e ') : null };
  });
  const grupos: { dias: number[]; horario: string | null }[] = [];
  for (const d of porDia) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.horario === d.horario) ultimo.dias.push(d.dia);
    else grupos.push({ dias: [d.dia], horario: d.horario });
  }
  const nome = (dias: number[], seguidos: boolean) => {
    const n = dias.map((d) => DIAS[d]!);
    const t =
      n.length === 1
        ? n[0]!
        : seguidos && n.length > 2
          ? `${n[0]} a ${n[n.length - 1]}`
          : `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`;
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const linhas: LinhaHorario[] = grupos
    .filter((g) => g.horario)
    .map((g) => ({ dias: nome(g.dias, true), horario: g.horario }));
  const fechados = grupos.filter((g) => !g.horario).flatMap((g) => g.dias);
  if (fechados.length) linhas.push({ dias: nome(fechados, false), horario: null });
  return linhas;
}

/** Hora em que a unidade fecha no dia (o último turno); null = não abre ou sem turnos. */
export function fechamentoDoDia(
  turnos: readonly TurnoFuncionamento[],
  diaSemana: number,
): number | null {
  const doDia = turnos.filter((t) => t.diaSemana === diaSemana);
  return doDia.length ? Math.max(...doDia.map((t) => t.fimMin)) : null;
}

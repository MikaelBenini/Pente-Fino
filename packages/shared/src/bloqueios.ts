// Bloqueios da agenda (Etapa 14): além do pontual, o que repete toda semana (almoço de toda
// terça) e as férias/folgas de vários dias. Regras puras; o banco grava e a agenda usa.
import { z } from 'zod';
import { diaDaSemana, instanteLocal } from './agenda.js';

export interface BloqueioRecorrente {
  id: string;
  diaSemana: number;
  inicioMin: number;
  fimMin: number;
  /** AAAA-MM-DD. */
  desde: string;
  ate: string | null;
  motivo: string | null;
}

/** As vezes que o bloqueio recorrente cai no dia (0 ou 1 intervalo). */
export function recorrentesNoDia(
  bloqueios: readonly Omit<BloqueioRecorrente, 'id' | 'motivo'>[],
  dia: string,
): { inicio: Date; fim: Date }[] {
  const ds = diaDaSemana(dia);
  return bloqueios
    .filter((b) => b.diaSemana === ds && b.desde <= dia && (!b.ate || dia <= b.ate))
    .map((b) => ({ inicio: instanteLocal(dia, b.inicioMin), fim: instanteLocal(dia, b.fimMin) }));
}

/** Intervalo inteiro de um dia (para mostrar férias de vários dias dia a dia). */
export function recorteDoDia(
  b: { inicio: Date; fim: Date },
  dia: string,
): { inicio: Date; fim: Date } | null {
  const abre = instanteLocal(dia, 0);
  const fecha = new Date(abre.getTime() + 86_400_000);
  if (b.fim <= abre || b.inicio >= fecha) return null;
  return {
    inicio: b.inicio < abre ? abre : b.inicio,
    fim: b.fim > fecha ? fecha : b.fim,
  };
}

const minuto = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

export const bloqueioRecorrenteSchema = z
  .object({
    diaSemana: z.number().int().min(0).max(6),
    inicioMin: minuto,
    fimMin: minuto,
    desde: z.iso.date(),
    ate: z.iso.date().nullable(),
    motivo: z.string().trim().max(80).nullable(),
  })
  .refine((b) => b.fimMin > b.inicioMin, {
    error: 'O fim precisa ser depois do início.',
    path: ['fimMin'],
  })
  .refine((b) => !b.ate || b.ate >= b.desde, {
    error: 'O fim precisa ser depois do começo.',
    path: ['ate'],
  });
export type BloqueioRecorrenteEntrada = z.infer<typeof bloqueioRecorrenteSchema>;

// ─── Encaixe ──────────────────────────────────────────────────────────────

export type AvisoEncaixe = 'fora_do_expediente' | 'bloqueio' | 'unidade_fechada';

export const TEXTO_AVISO_ENCAIXE: Readonly<Record<AvisoEncaixe, string>> = {
  fora_do_expediente: 'fora do expediente do profissional',
  bloqueio: 'em cima de um bloqueio da agenda',
  unidade_fechada: 'num dia em que a unidade não abre',
};

/** "Encaixe fora do expediente e em cima de um bloqueio. Encaixar mesmo assim?" */
export function textoAvisosEncaixe(avisos: readonly AvisoEncaixe[]): string {
  const partes = avisos.map((a) => TEXTO_AVISO_ENCAIXE[a]);
  const lista =
    partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
  return `Esse horário fica ${lista}. Encaixar mesmo assim?`;
}

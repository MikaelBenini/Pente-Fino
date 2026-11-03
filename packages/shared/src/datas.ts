import type { DataISO } from './vigencia.js';

/** Datas ficam em UTC no banco; a exibição usa este fuso. */
export const FUSO_EXIBICAO = 'America/Sao_Paulo';

/** Dia local (AAAA-MM-DD) de um instante, no fuso informado. */
export function dataLocal(instante: Date, fuso: string = FUSO_EXIBICAO): DataISO {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** Converte um Date de coluna `date` do banco (meia-noite UTC) em AAAA-MM-DD. */
export function dataDoBanco(data: Date): DataISO {
  return data.toISOString().slice(0, 10);
}

/** Converte AAAA-MM-DD em Date de meia-noite UTC, como o banco guarda colunas `date`. */
export function dataParaBanco(data: DataISO): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

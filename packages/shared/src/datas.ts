import type { DataISO } from './vigencia.js';

/** Datas ficam em UTC no banco; a exibição usa este fuso. */
export const FUSO_EXIBICAO = 'America/Sao_Paulo';

/**
 * Criar um Intl.DateTimeFormat custa caro (~0,2 ms); a ficha e os indicadores chamam
 * dataLocal milhares de vezes por consulta. Um formatador por fuso, reaproveitado.
 */
const formatadores = new Map<string, Intl.DateTimeFormat>();

/** Dia local (AAAA-MM-DD) de um instante, no fuso informado. */
export function dataLocal(instante: Date, fuso: string = FUSO_EXIBICAO): DataISO {
  let f = formatadores.get(fuso);
  if (!f) {
    // en-CA formata como AAAA-MM-DD.
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatadores.set(fuso, f);
  }
  return f.format(instante);
}

/** Converte um Date de coluna `date` do banco (meia-noite UTC) em AAAA-MM-DD. */
export function dataDoBanco(data: Date): DataISO {
  return data.toISOString().slice(0, 10);
}

/** Converte AAAA-MM-DD em Date de meia-noite UTC, como o banco guarda colunas `date`. */
export function dataParaBanco(data: DataISO): Date {
  return new Date(`${data}T00:00:00.000Z`);
}

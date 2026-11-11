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

const somar = (d: DataISO, n: number): DataISO => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Último dia (AAAA-MM-DD) do mês AAAA-MM. */
export function ultimoDiaDe(mes: string): DataISO {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/**
 * Período com que um período se compara, em todo o sistema (Início, Financeiro, Resultados do
 * mês). Mês do calendário: o mês anterior inteiro; se for o mês corrente, só os mesmos dias do
 * mês anterior (1 até o dia de hoje), senão o mês pela metade parece ter despencado. Outro
 * período: os mesmos N dias logo antes.
 */
export function periodoAnterior(
  de: DataISO,
  ate: DataISO,
  hoje: DataISO,
): { de: DataISO; ate: DataISO } {
  const mes = de.slice(0, 7);
  if (de.endsWith('-01') && ate === ultimoDiaDe(mes)) {
    const [a, m] = mes.split('-').map(Number) as [number, number];
    const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
    const fim = ultimoDiaDe(anterior);
    const mesmoDia = `${anterior}-${hoje.slice(8, 10)}`;
    return {
      de: `${anterior}-01`,
      ate: hoje.slice(0, 7) === mes && mesmoDia < fim ? mesmoDia : fim,
    };
  }
  const n =
    Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1;
  return { de: somar(de, -n), ate: somar(de, -1) };
}

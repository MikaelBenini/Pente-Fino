import { dataLocal } from '@pente-fino/shared';

export const mesAtual = () => dataLocal(new Date()).slice(0, 7);

export function limitesDoMes(mes: string): [string, string] {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return [
    `${mes}-01`,
    `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`,
  ];
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export function mesSeguinte(mes: string): string {
  const [a, m] = mes.split('-').map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

export function nomeDoMes(mes: string): string {
  return new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

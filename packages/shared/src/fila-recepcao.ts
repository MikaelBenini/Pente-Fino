// Modo recepção (seção 7): a tela grande do balcão. A fila do dia em três colunas (quem chega, quem
// está na cadeira e quem falta receber), com o próximo cliente em destaque.
import type { ComandaResumo } from './esquemas-operacao.js';

export interface FilaRecepcao {
  /** O próximo a ser atendido: o primeiro previsto, mesmo que atrasado. */
  proximo: ComandaResumo | null;
  chegando: ComandaResumo[];
  naCadeira: ComandaResumo[];
  paraReceber: ComandaResumo[];
  /** Quantos dos que chegam já passaram do horário. */
  atrasados: number;
}

const porHorario = (a: ComandaResumo, b: ComandaResumo) =>
  (a.inicio ?? '9999').localeCompare(b.inicio ?? '9999');

/** Previsto cujo horário já passou (com 5 minutos de tolerância). */
export function chegadaAtrasada(c: Pick<ComandaResumo, 'status' | 'inicio'>, agora: Date): boolean {
  return (
    c.status === 'prevista' &&
    !!c.inicio &&
    new Date(c.inicio).getTime() + 5 * 60_000 < agora.getTime()
  );
}

/** Monta a fila do dia; fechadas e canceladas saem da tela. */
export function filaDaRecepcao(comandas: readonly ComandaResumo[], agora: Date): FilaRecepcao {
  const chegando = comandas.filter((c) => c.status === 'prevista').sort(porHorario);
  const naCadeira = comandas.filter((c) => c.status === 'em_atendimento').sort(porHorario);
  const paraReceber = comandas
    .filter((c) => c.status === 'confirmada' || c.status === 'pendente' || c.status === 'reaberta')
    .sort(porHorario);
  return {
    proximo: chegando[0] ?? null,
    chegando,
    naCadeira,
    paraReceber,
    atrasados: chegando.filter((c) => chegadaAtrasada(c, agora)).length,
  };
}

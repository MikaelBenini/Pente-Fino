// Avaliação depois do atendimento (Etapa 10.1, adiantando a 12): o cliente dá nota de 1 a 5
// para o atendimento do profissional e para a barbearia, pelo WhatsApp, e pode comentar.
import { z } from 'zod';

/** Igual ao `normalizar` do bot (sem acento, minúsculo); aqui para o bot poder importar este arquivo. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A pesquisa sai este tempo depois do fechamento da comanda. */
export const PESQUISA_ATRASO_MIN = 60;
/** Sem resposta neste prazo, a pesquisa expira sem insistir. */
export const PESQUISA_VALIDADE_HORAS = 48;
/** No máximo uma pesquisa por cliente neste intervalo. */
export const PESQUISA_INTERVALO_DIAS = 7;
/** Nota até aqui é "baixa": aparece em destaque para dono e gestor. */
export const NOTA_BAIXA = 2;

const POR_EXTENSO: Readonly<Record<string, number>> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
};

/**
 * A nota que o cliente mandou: "5", "nota 4", "dou 3", "4 de 5", "cinco", "5 estrelas" ou
 * ⭐⭐⭐⭐. Qualquer outra coisa (inclusive 0 ou 10) não é nota.
 */
export function lerNota(entrada: string): number | null {
  const estrelas = (entrada.match(/⭐|★/g) ?? []).length;
  if (estrelas >= 1 && estrelas <= 5 && !/\d/.test(entrada)) return estrelas;
  const t = normalizar(entrada).replace(/^(?:nota|dou|da|e)\s+/, '');
  const primeira = t.split(' ')[0] ?? '';
  const n = /^[1-5]$/.test(primeira) ? Number(primeira) : POR_EXTENSO[primeira];
  if (n === undefined) return null;
  // "4 de 5" e "4 5" (de "4/5") valem; "4 cortes" não é nota.
  const resto = t.slice(primeira.length).trim();
  return resto === '' || /^(?:de 5|5|estrelas?|pontos?)$/.test(resto) ? n : null;
}

export interface ResumoNotas {
  /** Média com uma casa; null sem resposta. */
  media: number | null;
  respostas: number;
  /** Quantas de cada nota: índice 0 = nota 1 … índice 4 = nota 5. */
  distribuicao: [number, number, number, number, number];
}

export function resumirNotas(notas: readonly (number | null | undefined)[]): ResumoNotas {
  const validas = notas.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 5);
  const distribuicao: ResumoNotas['distribuicao'] = [0, 0, 0, 0, 0];
  for (const n of validas) distribuicao[n - 1]! += 1;
  return {
    media: validas.length
      ? Math.round((validas.reduce((s, n) => s + n, 0) / validas.length) * 10) / 10
      : null,
    respostas: validas.length,
    distribuicao,
  };
}

/** Notas do período mais o quanto a pesquisa foi respondida. */
export interface NotasDoPeriodo extends ResumoNotas {
  /** Pesquisas enviadas no período. */
  enviadas: number;
  /** Respondidas ÷ enviadas; null sem envio. */
  taxaResposta: number | null;
}

export interface ComentarioAvaliacao {
  /** Id da avaliação (para marcar a nota baixa como resolvida). */
  id: string;
  comandaId: string;
  notaAtendimento: number;
  notaBarbearia: number | null;
  comentario: string | null;
  /** ISO de quando respondeu. */
  respondidaEm: string;
  profissional: string;
  /** Nome do cliente (nunca o telefone); null para o barbeiro. */
  cliente: string | null;
  /** Para o atalho "Ver cliente"; null para o barbeiro. */
  clienteId: string | null;
  /** Nota baixa já resolvida: quando, por quem e o que foi feito. */
  tratamento: { em: string; por: string | null; anotacao: string } | null;
}

/** Marcar a nota baixa como resolvida, com o que foi feito. */
export const tratarAvaliacaoSchema = z.object({
  anotacao: z
    .string()
    .trim()
    .min(3, { error: 'Conte em poucas palavras o que foi feito.' })
    .max(500),
});
export type TratarAvaliacaoEntrada = z.infer<typeof tratarAvaliacaoSchema>;

/** Nota que vale o convite para avaliar no Google: a da barbearia, ou a do atendimento sem ela. */
export function mereceConviteGoogle(notaAtendimento: number | null, notaBarbearia: number | null) {
  return (notaBarbearia ?? notaAtendimento) === 5 && (notaAtendimento ?? 5) > NOTA_BAIXA;
}

/** Avaliações da barbearia no período (Resultados do mês). */
export interface ResumoAvaliacoes {
  pesquisaAtiva: boolean;
  atendimento: NotasDoPeriodo;
  barbearia: ResumoNotas;
  /** Nota do atendimento ou da barbearia até NOTA_BAIXA: para o dono falar com o cliente. */
  baixas: ComentarioAvaliacao[];
  /** Os comentários mais recentes. */
  comentarios: ComentarioAvaliacao[];
}

export function notasDoPeriodo(
  notas: readonly (number | null | undefined)[],
  enviadas: number,
): NotasDoPeriodo {
  const r = resumirNotas(notas);
  return {
    ...r,
    enviadas,
    taxaResposta: enviadas > 0 ? Math.min(1, r.respostas / enviadas) : null,
  };
}

// Avaliações depois do atendimento: leitura para a ficha, o ranking e o resumo da barbearia.
import type { Prisma, Transacao } from '@pente-fino/db';
import {
  NOTA_BAIXA,
  notasDoPeriodo,
  resumirNotas,
  type ComentarioAvaliacao,
  type NotasDoPeriodo,
  type ResumoAvaliacoes,
} from '@pente-fino/shared';
import { somarDias } from '../resultados/resultados.service.js';

const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`);
const periodo = (de: string, ate: string) => ({
  gte: inicioDoDia(de),
  lt: inicioDoDia(somarDias(ate, 1)),
});

/** Respondidas no período (mais recentes primeiro) e quantas foram enviadas nele. */
export async function avaliacoesDoPeriodo(
  tx: Transacao,
  where: Prisma.AvaliacaoWhereInput,
  de: string,
  ate: string,
) {
  const [respondidas, enviadas] = await Promise.all([
    tx.avaliacao.findMany({
      where: { ...where, status: 'respondida', respondidaEm: periodo(de, ate) },
      orderBy: { respondidaEm: 'desc' },
      include: {
        cliente: { select: { nome: true } },
        profissional: { include: { usuario: { select: { nome: true } } } },
      },
    }),
    tx.avaliacao.count({ where: { ...where, enviadaEm: periodo(de, ate) } }),
  ]);
  return { respondidas, enviadas };
}

type Respondida = Awaited<ReturnType<typeof avaliacoesDoPeriodo>>['respondidas'][number];

export function comentarioDe(a: Respondida, comCliente: boolean): ComentarioAvaliacao {
  return {
    comandaId: a.comandaId,
    notaAtendimento: a.notaAtendimento!,
    notaBarbearia: a.notaBarbearia,
    comentario: a.comentario,
    respondidaEm: a.respondidaEm!.toISOString(),
    profissional: a.profissional.usuario.nome,
    cliente: comCliente ? a.cliente.nome : null,
  };
}

/** Notas do atendimento de cada profissional no período (para o ranking). */
export async function notaPorProfissional(
  tx: Transacao,
  ids: string[],
  de: string,
  ate: string,
): Promise<Map<string, number | null>> {
  const lista = await tx.avaliacao.findMany({
    where: { profissionalId: { in: ids }, status: 'respondida', respondidaEm: periodo(de, ate) },
    select: { profissionalId: true, notaAtendimento: true },
  });
  return new Map(
    ids.map((id) => [
      id,
      resumirNotas(lista.filter((a) => a.profissionalId === id).map((a) => a.notaAtendimento))
        .media,
    ]),
  );
}

/** Ficha do profissional: notas do atendimento dele e os comentários (sem nome do cliente). */
export async function avaliacoesDoProfissional(
  tx: Transacao,
  profissionalId: string,
  de: string,
  ate: string,
): Promise<NotasDoPeriodo & { comentarios: ComentarioAvaliacao[] }> {
  const { respondidas, enviadas } = await avaliacoesDoPeriodo(tx, { profissionalId }, de, ate);
  return {
    ...notasDoPeriodo(
      respondidas.map((a) => a.notaAtendimento),
      enviadas,
    ),
    comentarios: respondidas
      .filter((a) => a.comentario)
      .slice(0, 20)
      .map((a) => comentarioDe(a, false)),
  };
}

/** Resumo da barbearia (dono e gestor): notas, baixas para tratar e comentários recentes. */
export async function resumoAvaliacoes(
  tx: Transacao,
  filtro: Record<string, unknown>,
  de: string,
  ate: string,
): Promise<ResumoAvaliacoes> {
  const conta = await tx.conta.findFirst({ select: { pesquisaPosAtendimento: true } });
  const { respondidas, enviadas } = await avaliacoesDoPeriodo(tx, filtro, de, ate);
  const baixa = (n: number | null) => n !== null && n <= NOTA_BAIXA;
  return {
    pesquisaAtiva: conta?.pesquisaPosAtendimento ?? false,
    atendimento: notasDoPeriodo(
      respondidas.map((a) => a.notaAtendimento),
      enviadas,
    ),
    barbearia: resumirNotas(respondidas.map((a) => a.notaBarbearia)),
    baixas: respondidas
      .filter((a) => baixa(a.notaAtendimento) || baixa(a.notaBarbearia))
      .slice(0, 20)
      .map((a) => comentarioDe(a, true)),
    comentarios: respondidas
      .filter((a) => a.comentario)
      .slice(0, 10)
      .map((a) => comentarioDe(a, true)),
  };
}

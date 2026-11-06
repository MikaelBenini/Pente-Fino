// Central de avisos (Etapa 15): grava o aviso para quem deve agir e devolve as notificações
// do celular (push) para o worker mandar. A regra de quem recebe está em packages/shared.
import {
  avisoComandasPendentes,
  dataLocal,
  destinatariosDoAviso,
  diaDaSemana,
  podeAvisarAgora,
  statusEfetivo,
  type AvisoNovo,
  type Papel,
  type StatusComanda,
  type TrabalhoNotificacao,
} from '@pente-fino/shared';
import type { Prisma, PrismaClient } from './generated/prisma/client.js';
import { naConta } from './index.js';

type Tx = Prisma.TransactionClient;

/** Minutos desde 00:00 em São Paulo (-03:00 fixo). */
const minutoLocal = (d: Date) => {
  const l = new Date(d.getTime() - 3 * 3_600_000);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};

/** Pessoas ativas da unidade com seus papéis ali (dono vale para todas as unidades). */
async function pessoasDaUnidade(tx: Tx, unidadeId: string) {
  const papeis = await tx.papelUsuario.findMany({
    where: { OR: [{ unidadeId }, { unidadeId: null }], usuario: { ativo: true } },
    select: { usuarioId: true, papel: true },
  });
  const porUsuario = new Map<string, Papel[]>();
  for (const p of papeis)
    porUsuario.set(p.usuarioId, [...(porUsuario.get(p.usuarioId) ?? []), p.papel as Papel]);
  return [...porUsuario].map(([usuarioId, ps]) => ({ usuarioId, papeis: ps }));
}

/**
 * Grava o aviso para quem deve recebê-lo na unidade (sem repetir a mesma chave para a mesma
 * pessoa) e devolve as notificações para os aparelhos de quem ligou o push.
 */
export async function gravarAviso(
  tx: Tx,
  contaId: string,
  unidadeId: string,
  aviso: AvisoNovo,
): Promise<TrabalhoNotificacao[]> {
  const ids = destinatariosDoAviso(aviso.tipo, await pessoasDaUnidade(tx, unidadeId));
  if (ids.length === 0) return [];
  const criados = await tx.aviso.createManyAndReturn({
    data: ids.map((usuarioId) => ({
      usuarioId,
      unidadeId,
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      texto: aviso.texto,
      link: aviso.link,
      chave: aviso.chave,
    })),
    skipDuplicates: true,
    select: { id: true, usuarioId: true },
  });
  if (criados.length === 0) return [];
  const comPush = await tx.inscricaoPush.findMany({
    where: { usuarioId: { in: criados.map((c) => c.usuarioId) } },
    select: { usuarioId: true },
    distinct: ['usuarioId'],
  });
  const ligados = new Set(comPush.map((p) => p.usuarioId));
  return criados
    .filter((c) => ligados.has(c.usuarioId))
    .map((c) => ({
      contaId,
      usuarioId: c.usuarioId,
      titulo: aviso.titulo,
      corpo: aviso.texto,
      url: aviso.link ?? '/avisos',
      etiqueta: `aviso-${c.id}`,
    }));
}

/** Contas para a rotina dos avisos (a lista sai sem entrar em nenhuma conta). */
export async function contasParaAvisos(prisma: PrismaClient): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.rotina', 'avisos', true)`;
    const contas = await tx.conta.findMany({ select: { id: true } });
    return contas.map((c) => c.id);
  });
}

/**
 * Rotina de 15 em 15 minutos, no expediente de cada unidade: comandas de hoje que passaram do
 * fim sem a confirmação do barbeiro e ainda não foram avisadas viram um aviso para a recepção.
 */
export async function rotinaComandasPendentes(
  prisma: PrismaClient,
  contaId: string,
  agora = new Date(),
): Promise<TrabalhoNotificacao[]> {
  return naConta(prisma, contaId, async (tx) => {
    const hoje = dataLocal(agora);
    const ds = diaDaSemana(hoje);
    const inicioDoDia = new Date(`${hoje}T00:00:00-03:00`);
    const unidades = await tx.unidade.findMany({
      where: { ativa: true },
      include: { profissionais: { where: { ativo: true }, include: { horarios: true } } },
    });
    const notificacoes: TrabalhoNotificacao[] = [];
    for (const u of unidades) {
      const turnos = u.profissionais.flatMap((p) => p.horarios.filter((h) => h.diaSemana === ds));
      if (!podeAvisarAgora(turnos, minutoLocal(agora))) continue;
      const abertas = await tx.comanda.findMany({
        where: {
          unidadeId: u.id,
          status: { in: ['prevista', 'em_atendimento', 'pendente'] },
          agendamento: { fim: { gte: inicioDoDia, lte: agora } },
        },
        include: {
          cliente: { select: { nome: true } },
          agendamento: { select: { fim: true } },
          profissional: { include: { usuario: { select: { nome: true } } } },
        },
        orderBy: { agendamento: { fim: 'asc' } },
      });
      const pendentes = abertas.filter(
        (c) =>
          statusEfetivo(c.status as StatusComanda, c.agendamento?.fim ?? null, agora) ===
          'pendente',
      );
      const novas = pendentes.filter((c) => !c.pendenteAvisadaEm);
      const aviso = avisoComandasPendentes({
        unidadeId: u.id,
        novas: novas.map((c) => ({
          comandaId: c.id,
          cliente: c.cliente?.nome ?? null,
          profissional: c.profissional.usuario.nome,
          fim: c.agendamento!.fim.toISOString(),
        })),
        total: pendentes.length,
      });
      if (!aviso) continue;
      await tx.comanda.updateMany({
        where: { id: { in: novas.map((c) => c.id) } },
        data: { pendenteAvisadaEm: agora },
      });
      notificacoes.push(...(await gravarAviso(tx, contaId, u.id, aviso)));
    }
    return notificacoes;
  });
}

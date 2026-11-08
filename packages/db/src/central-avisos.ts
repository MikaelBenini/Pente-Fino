// Central de avisos (Etapa 15): grava o aviso para quem deve agir e devolve as notificações
// do celular (push) para o worker mandar. A regra de quem recebe está em packages/shared.
import {
  avisoCaixaSemFechar,
  avisoComandasPendentes,
  avisoResumoDoDia,
  emailResumoDoDia,
  fimDoDiaDaUnidade,
  lerPreferenciasAvisos,
  vaiParaOCelular,
  dataLocal,
  destinatariosDoAviso,
  diaDaSemana,
  podeAvisarAgora,
  statusEfetivo,
  type AvisoNovo,
  type Papel,
  type StatusComanda,
  type TrabalhoEmail,
  type TrabalhoNotificacao,
} from '@pente-fino/shared';
import { resumoGestao } from './equipe-whatsapp.js';
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
    select: { usuarioId: true, usuario: { select: { preferenciasAvisos: true } } },
    distinct: ['usuarioId'],
  });
  // Push só para quem tem aparelho e não desligou este tipo no Perfil.
  const ligados = new Set(
    comPush
      .filter((p) =>
        vaiParaOCelular(lerPreferenciasAvisos(p.usuario.preferenciasAvisos), aviso.tipo),
      )
      .map((p) => p.usuarioId),
  );
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

export interface SaidaDaRotina {
  notificacoes: TrabalhoNotificacao[];
  emails: TrabalhoEmail[];
}

/**
 * Comandas de hoje que passaram do fim sem a confirmação do barbeiro e ainda não foram
 * avisadas viram um aviso para a recepção.
 */
async function comandasPendentes(tx: Tx, contaId: string, unidadeId: string, agora: Date) {
  const inicioDoDia = new Date(`${dataLocal(agora)}T00:00:00-03:00`);
  const abertas = await tx.comanda.findMany({
    where: {
      unidadeId,
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
      statusEfetivo(c.status as StatusComanda, c.agendamento?.fim ?? null, agora) === 'pendente',
  );
  const novas = pendentes.filter((c) => !c.pendenteAvisadaEm);
  const aviso = avisoComandasPendentes({
    unidadeId,
    novas: novas.map((c) => ({
      comandaId: c.id,
      cliente: c.cliente?.nome ?? null,
      profissional: c.profissional.usuario.nome,
      fim: c.agendamento!.fim.toISOString(),
    })),
    total: pendentes.length,
  });
  if (!aviso) return [];
  await tx.comanda.updateMany({
    where: { id: { in: novas.map((c) => c.id) } },
    data: { pendenteAvisadaEm: agora },
  });
  return gravarAviso(tx, contaId, unidadeId, aviso);
}

/**
 * Fim do dia da unidade (meia hora depois do último turno): resumo para dono e gestor (com o
 * ritmo do mês; por e-mail para quem escolheu) e, se o caixa recebeu e não foi fechado, o
 * aviso para fechar. Cada um sai uma vez por dia (chave do aviso).
 */
async function fimDoDia(
  tx: Tx,
  contaId: string,
  unidade: { id: string; nome: string },
  agora: Date,
  appUrl: string,
): Promise<SaidaDaRotina> {
  const hoje = dataLocal(agora);
  const saida: SaidaDaRotina = { notificacoes: [], emails: [] };
  const [resumo] = await resumoGestao(tx, [unidade.id], hoje);
  if (resumo) {
    const aviso = avisoResumoDoDia({ unidadeId: unidade.id, dia: hoje, resumo });
    const antes = await tx.aviso.findMany({
      where: { chave: aviso.chave },
      select: { usuarioId: true },
    });
    saida.notificacoes.push(...(await gravarAviso(tx, contaId, unidade.id, aviso)));
    // E-mail só na primeira vez (quem já tinha o aviso de hoje não recebe de novo).
    const ja = new Set(antes.map((a) => a.usuarioId));
    const novos = await tx.aviso.findMany({
      where: { chave: aviso.chave, usuarioId: { notIn: [...ja] } },
      include: { usuario: { select: { nome: true, email: true, preferenciasAvisos: true } } },
    });
    for (const n of novos) {
      if (!lerPreferenciasAvisos(n.usuario.preferenciasAvisos).resumoPorEmail) continue;
      const e = emailResumoDoDia({
        nome: n.usuario.nome,
        dia: hoje,
        resumo,
        link: `${appUrl}/inicio`,
      });
      saida.emails.push({ para: n.usuario.email, assunto: e.assunto, texto: e.texto });
    }
  }
  const caixa = await tx.caixaDia.findUnique({
    where: { unidadeId_data: { unidadeId: unidade.id, data: new Date(`${hoje}T00:00:00Z`) } },
  });
  if (!caixa?.fechadoEm) {
    const doDia = { gte: new Date(`${hoje}T00:00:00-03:00`), lte: agora };
    const recebido = await tx.pagamento.aggregate({
      where: { comanda: { unidadeId: unidade.id }, criadoEm: doDia },
      _sum: { valor: true },
    });
    const aviso = avisoCaixaSemFechar({
      unidadeId: unidade.id,
      unidade: unidade.nome,
      dia: hoje,
      recebido: recebido._sum.valor ?? 0,
    });
    if (aviso) saida.notificacoes.push(...(await gravarAviso(tx, contaId, unidade.id, aviso)));
  }
  return saida;
}

/**
 * Rotina de 15 em 15 minutos em cada unidade: comandas pendentes durante o expediente e, depois
 * do fim do dia, o resumo e o caixa aberto.
 */
export async function rotinaDosAvisos(
  prisma: PrismaClient,
  contaId: string,
  agora = new Date(),
  appUrl = '',
): Promise<SaidaDaRotina> {
  return naConta(prisma, contaId, async (tx) => {
    const ds = diaDaSemana(dataLocal(agora));
    const minuto = minutoLocal(agora);
    const unidades = await tx.unidade.findMany({
      where: { ativa: true },
      include: { profissionais: { where: { ativo: true }, include: { horarios: true } } },
    });
    const saida: SaidaDaRotina = { notificacoes: [], emails: [] };
    for (const u of unidades) {
      const turnos = u.profissionais.flatMap((p) => p.horarios.filter((h) => h.diaSemana === ds));
      if (podeAvisarAgora(turnos, minuto))
        saida.notificacoes.push(...(await comandasPendentes(tx, contaId, u.id, agora)));
      const fim = fimDoDiaDaUnidade(turnos);
      if (fim !== null && minuto >= fim) {
        const r = await fimDoDia(tx, contaId, u, agora, appUrl);
        saida.notificacoes.push(...r.notificacoes);
        saida.emails.push(...r.emails);
      }
    }
    return saida;
  });
}

/**
 * O WhatsApp da unidade caiu sozinho (Etapa 19): aviso na central para dono e gestor, com as
 * notificações do celular, e quem recebe o e-mail (os donos). Chave pela hora da queda: cair de
 * novo depois de reconectar avisa de novo.
 */
export async function avisarConexaoCaida(
  tx: Tx,
  contaId: string,
  unidadeId: string,
  caiuEm: Date,
): Promise<{
  conta: string;
  unidade: string;
  notificacoes: TrabalhoNotificacao[];
  donos: { nome: string; email: string }[];
}> {
  const [conta, unidade, donos] = await Promise.all([
    tx.conta.findUniqueOrThrow({ where: { id: contaId }, select: { nome: true } }),
    tx.unidade.findUniqueOrThrow({ where: { id: unidadeId }, select: { nome: true } }),
    tx.usuario.findMany({
      where: { ativo: true, papeis: { some: { papel: 'dono' } } },
      select: { nome: true, email: true },
    }),
  ]);
  const notificacoes = await gravarAviso(tx, contaId, unidadeId, {
    tipo: 'whatsapp_caiu',
    titulo: `WhatsApp da ${unidade.nome} desconectado`,
    texto:
      'O bot parou de responder e os lembretes não saem. Leia o QR Code na tela Bot para voltar.',
    link: '/bot',
    chave: `whatsapp_caiu:${unidadeId}:${caiuEm.toISOString()}`,
  });
  return { conta: conta.nome, unidade: unidade.nome, notificacoes, donos };
}

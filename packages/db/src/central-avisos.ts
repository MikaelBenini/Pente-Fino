// Central de avisos (Etapa 15): grava o aviso para quem deve agir e devolve as notificações
// do celular (push) para o worker mandar. A regra de quem recebe está em packages/shared.
import {
  avisoCaixaSemFechar,
  linkDoAviso,
  avisoClienteEsperando,
  avisoNotaBaixa,
  ESPERA_PARA_AVISAR_MIN,
  formatarTelefone,
  avisoComandasPendentes,
  avisoResumoDoDia,
  emailResumoDoDia,
  fimDoDiaDaUnidade,
  lerFuncionamento,
  lerPreferenciasAvisos,
  vaiParaOCelular,
  dataLocal,
  dataParaBanco,
  destinatariosDoAviso,
  diaDaSemana,
  podeAvisarAgora,
  statusEfetivo,
  type AvisoNovo,
  type Papel,
  type StatusComanda,
  type TrabalhoEmail,
  type TrabalhoNotificacao,
  ehHoraDoEmailDaSemana,
  emailSemanaDoNumero,
  fimDoAquecimento,
  limiteProativasDoDia,
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
      url: linkDoAviso({ ...aviso, unidadeId }) ?? '/avisos',
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
/**
 * Quem pediu atendente no WhatsApp e espera há mais de ESPERA_PARA_AVISAR_MIN sem resposta
 * (pedido do dono em 16/11/2026). Um aviso por pedido (a chave leva o início da espera).
 */
async function clientesEsperando(tx: Tx, contaId: string, unidadeId: string, agora: Date) {
  const limite = new Date(agora.getTime() - ESPERA_PARA_AVISAR_MIN * 60_000);
  const sessoes = await tx.botSessao.findMany({
    where: { unidadeId, atendenteDesde: { lte: limite } },
    include: { cliente: { select: { nome: true } } },
  });
  const saida: TrabalhoNotificacao[] = [];
  for (const s of sessoes) {
    const aviso = avisoClienteEsperando({
      unidadeId,
      sessaoId: s.id,
      cliente: s.cliente?.nome ?? formatarTelefone(s.telefone),
      desde: s.atendenteDesde!.toISOString(),
      minutos: Math.round((agora.getTime() - s.atendenteDesde!.getTime()) / 60_000),
    });
    saida.push(...(await gravarAviso(tx, contaId, unidadeId, aviso)));
  }
  return saida;
}

/**
 * Nota 1 ou 2 também na central de avisos (com a notificação do celular), além da mensagem para a
 * equipe no WhatsApp. Uma vez por avaliação (a chave é a avaliação).
 */
export async function avisoCentralNotaBaixa(
  prisma: PrismaClient,
  contaId: string,
  avaliacaoId: string,
): Promise<TrabalhoNotificacao[]> {
  return naConta(prisma, contaId, async (tx) => {
    const av = await tx.avaliacao.findUnique({
      where: { id: avaliacaoId },
      include: {
        cliente: { select: { nome: true } },
        profissional: { include: { usuario: { select: { nome: true } } } },
      },
    });
    if (!av) return [];
    const nota = Math.min(av.notaAtendimento ?? 5, av.notaBarbearia ?? 5);
    if (nota > 2) return [];
    return gravarAviso(
      tx,
      contaId,
      av.unidadeId,
      avisoNotaBaixa({
        avaliacaoId,
        cliente: av.cliente.nome,
        profissional: av.profissional.usuario.nome.trim().split(/\s+/)[0]!,
        nota,
        comentario: av.comentario,
      }),
    );
  });
}

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

/** A semana do número da unidade (os últimos 7 dias, até ontem) para quem deixou ligado. */
async function emailsDaSemanaDoNumero(
  tx: Tx,
  unidade: { id: string; nome: string },
  agora: Date,
  appUrl: string,
): Promise<SaidaDaRotina['emails']> {
  const c = await tx.botConexao.findUnique({ where: { unidadeId: unidade.id } });
  if (!c || c.status !== 'conectado') return [];
  const hoje = dataLocal(agora);
  const de = dataLocal(new Date(agora.getTime() - 7 * 86_400_000));
  const ate = dataLocal(new Date(agora.getTime() - 86_400_000));
  const periodo = { gte: new Date(`${de}T00:00:00-03:00`), lt: new Date(`${hoje}T00:00:00-03:00`) };
  const [proativas, saidas, pausas] = await Promise.all([
    tx.mensagem.count({ where: { unidadeId: unidade.id, proativa: true, enviadaEm: periodo } }),
    tx.mensagem.count({
      where: {
        unidadeId: unidade.id,
        direcao: 'entrada',
        texto: { equals: 'sair', mode: 'insensitive' },
        criadoEm: periodo,
      },
    }),
    tx.aviso.groupBy({
      by: ['chave'],
      where: { unidadeId: unidade.id, tipo: 'whatsapp_protegido', criadoEm: periodo },
    }),
  ]);
  const semana = {
    unidade: unidade.nome,
    de,
    ate,
    proativas,
    saidas,
    pausas: pausas.length,
    limiteHoje: limiteProativasDoDia(c.conectadoEm, agora),
    aquecendo: fimDoAquecimento(c.conectadoEm, agora) !== null,
  };
  const ids = destinatariosDoAviso('whatsapp_protegido', await pessoasDaUnidade(tx, unidade.id));
  if (!ids.length) return [];
  const usuarios = await tx.usuario.findMany({
    where: { id: { in: ids } },
    select: { nome: true, email: true, preferenciasAvisos: true },
  });
  return usuarios
    .filter((p) => lerPreferenciasAvisos(p.preferenciasAvisos).semanaWhatsappPorEmail)
    .map((p) => {
      const e = emailSemanaDoNumero({ nome: p.nome, semana, link: `${appUrl}/bot?aba=conexao` });
      return { para: p.email, assunto: e.assunto, texto: e.texto };
    });
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
    // Verificação final (C4): dia marcado como fechado no calendário (feriado, folga) não tem
    // comanda pendente nem resumo e caixa do fim do dia.
    const fechadas = new Set(
      (
        await tx.calendarioUnidade.findMany({
          where: { data: dataParaBanco(dataLocal(agora)), trabalha: false },
          select: { unidadeId: true },
        })
      ).map((d) => d.unidadeId),
    );
    for (const u of unidades) {
      // Segunda às 9 h: a semana do número de WhatsApp por e-mail (vale até em dia fechado).
      if (ehHoraDoEmailDaSemana(ds, minuto))
        saida.emails.push(...(await emailsDaSemanaDoNumero(tx, u, agora, appUrl)));
      if (fechadas.has(u.id)) continue;
      // O horário de funcionamento da unidade, quando cadastrado, manda no fim do dia (os avisos
      // de resumo saem no fechamento); sem ele, o expediente da equipe.
      const daUnidade = lerFuncionamento(u.horarioFuncionamento).filter((t) => t.diaSemana === ds);
      const turnos = daUnidade.length
        ? daUnidade
        : u.profissionais.flatMap((p) => p.horarios.filter((h) => h.diaSemana === ds));
      if (podeAvisarAgora(turnos, minuto)) {
        saida.notificacoes.push(...(await comandasPendentes(tx, contaId, u.id, agora)));
        saida.notificacoes.push(...(await clientesEsperando(tx, contaId, u.id, agora)));
      }
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

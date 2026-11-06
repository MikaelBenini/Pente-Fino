// Agenda: expediente, horários livres e criação do agendamento com a comanda prevista.
// Fonte única para o balcão (API), o link público (API) e o bot (worker).
import {
  dataLocal,
  diaDaSemana,
  horariosLivres,
  instanteLocal,
  lerRegrasAgendamento,
  momentoProximoCliente,
  trabalhosDeLembrete,
  type HorarioLivre,
  type LembreteDeHorario,
  type ProximoClienteDaEquipe,
  type RegrasAgendamento,
  type DataISO,
  recorrentesNoDia,
  type AvisoEncaixe,
} from '@pente-fino/shared';
import type { OrigemAgendamento, Prisma } from './generated/prisma/client.js';
import { partesDoServico } from './clube.js';
import { precoServicoVigente } from './vigencia.js';

type Tx = Prisma.TransactionClient;

/** Erro de regra da agenda; quem chama traduz (a API para HTTP, o bot para uma frase). */
export class ErroAgenda extends Error {
  constructor(
    readonly codigo: 'nao_encontrado' | 'conflito' | 'sem_preco',
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const dataBanco = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const diaDoBanco = (d: Date) => d.toISOString().slice(0, 10);

/** Regras de agendamento da unidade (com o padrão no que não foi configurado). */
export async function regrasDaUnidade(tx: Tx, unidadeId: string): Promise<RegrasAgendamento> {
  const u = await tx.unidade.findUnique({
    where: { id: unidadeId },
    select: { regrasAgendamento: true },
  });
  return lerRegrasAgendamento(u?.regrasAgendamento);
}

/** Ocupado mais a folga antes e depois (intervalo entre atendimentos). */
const comFolga = (ocupados: { inicio: Date; fim: Date }[], intervaloMin: number) =>
  intervaloMin > 0
    ? ocupados.map((o) => ({
        inicio: new Date(o.inicio.getTime() - intervaloMin * 60_000),
        fim: new Date(o.fim.getTime() + intervaloMin * 60_000),
      }))
    : ocupados;

/** Expediente do profissional no dia, respeitando os dias da unidade e o calendário. */
export async function expedienteDoProfissional(
  tx: Tx,
  profissionalId: string,
  unidadeId: string,
  dia: string,
) {
  const prof = await tx.profissional.findUnique({
    where: { id: profissionalId },
    include: { horarios: true },
  });
  const unidade = await tx.unidade.findUnique({ where: { id: unidadeId } });
  const excecao = await tx.calendarioUnidade.findUnique({
    where: { unidadeId_data: { unidadeId, data: dataBanco(dia) } },
  });
  if (!prof || prof.unidadeId !== unidadeId || !prof.ativo)
    throw new ErroAgenda('nao_encontrado', 'Profissional não encontrado nesta unidade.');
  if (prof.dataSaida && diaDoBanco(prof.dataSaida) < dia) return [];
  const ds = diaDaSemana(dia);
  const abre = excecao ? excecao.trabalha : !!unidade?.diasTrabalho.includes(ds);
  if (!abre) return [];
  return prof.horarios
    .filter((h) => h.diaSemana === ds)
    .map((h) => ({ inicio: instanteLocal(dia, h.inicioMin), fim: instanteLocal(dia, h.fimMin) }));
}

/** Agendamentos ativos e bloqueios do profissional no dia. */
export async function ocupadosDoProfissional(
  tx: Tx,
  profissionalId: string,
  dia: string,
  ignorar?: string,
) {
  const inicio = new Date(`${dia}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 86_400_000);
  const ags = await tx.agendamento.findMany({
    where: {
      profissionalId,
      inicio: { lt: fim },
      fim: { gt: inicio },
      status: { notIn: ['cancelado', 'falta'] },
      ...(ignorar ? { id: { not: ignorar } } : {}),
    },
  });
  return [
    ...ags.map((x) => ({ inicio: x.inicio, fim: x.fim })),
    ...(await bloqueiosDoDia(tx, profissionalId, dia)),
  ];
}

/** Bloqueios do profissional no dia: os pontuais (e férias) e os que repetem toda semana. */
export async function bloqueiosDoDia(
  tx: Tx,
  profissionalId: string,
  dia: string,
): Promise<{ inicio: Date; fim: Date }[]> {
  const inicio = new Date(`${dia}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 86_400_000);
  const bls = await tx.bloqueioAgenda.findMany({
    where: { profissionalId, inicio: { lt: fim }, fim: { gt: inicio } },
  });
  const recorrentes = await tx.bloqueioRecorrente.findMany({ where: { profissionalId } });
  return [
    ...bls.map((b) => ({ inicio: b.inicio, fim: b.fim })),
    ...recorrentesNoDia(
      recorrentes.map((r) => ({
        diaSemana: r.diaSemana,
        inicioMin: r.inicioMin,
        fimMin: r.fimMin,
        desde: diaDoBanco(r.desde),
        ate: r.ate ? diaDoBanco(r.ate) : null,
      })),
      dia,
    ),
  ];
}

/**
 * Encaixe (Etapa 14): a recepção marca fora da grade. Não recusa por expediente, bloqueio ou
 * unidade fechada, mas devolve os avisos para ela confirmar; outro cliente no mesmo horário
 * continua impossível (o banco também impede).
 */
export async function avisosDoEncaixe(
  tx: Tx,
  profissionalId: string,
  unidadeId: string,
  inicio: Date,
  fim: Date,
  ignorar?: string,
): Promise<AvisoEncaixe[]> {
  const dia = dataLocal(inicio);
  const outros = await tx.agendamento.count({
    where: {
      profissionalId,
      inicio: { lt: fim },
      fim: { gt: inicio },
      status: { notIn: ['cancelado', 'falta'] },
      ...(ignorar ? { id: { not: ignorar } } : {}),
    },
  });
  if (outros > 0)
    throw new ErroAgenda('conflito', 'Este profissional já tem um cliente nesse horário.');
  const avisos: AvisoEncaixe[] = [];
  const unidade = await tx.unidade.findUnique({ where: { id: unidadeId } });
  const excecao = await tx.calendarioUnidade.findUnique({
    where: { unidadeId_data: { unidadeId, data: dataBanco(dia) } },
  });
  const abre = excecao ? excecao.trabalha : !!unidade?.diasTrabalho.includes(diaDaSemana(dia));
  if (!abre) avisos.push('unidade_fechada');
  else {
    const turnos = await expedienteDoProfissional(tx, profissionalId, unidadeId, dia);
    if (!turnos.some((t) => t.inicio <= inicio && fim <= t.fim)) avisos.push('fora_do_expediente');
  }
  if ((await bloqueiosDoDia(tx, profissionalId, dia)).some((b) => b.inicio < fim && inicio < b.fim))
    avisos.push('bloqueio');
  return avisos;
}

/**
 * Horários livres de cada profissional ativo da unidade (ou de um só) no dia, com o
 * intervalo entre atendimentos da unidade. `antecedenciaMin` (bot e site) tira os horários
 * próximos demais de agora; o balcão passa 0 (encaixe).
 */
export async function calcularLivres(
  tx: Tx,
  unidadeId: string,
  dia: string,
  duracaoMin: number,
  profissionalId?: string,
  agora = new Date(),
  /** `ignorar`: o próprio agendamento, ao remarcar (o horário dele conta como livre). */
  opcoes: { antecedenciaMin?: number; ignorar?: string } = {},
): Promise<HorarioLivre[]> {
  const regras = await regrasDaUnidade(tx, unidadeId);
  const profs = await tx.profissional.findMany({
    where: { unidadeId, ativo: true, ...(profissionalId ? { id: profissionalId } : {}) },
  });
  const aPartirDe = new Date(agora.getTime() + (opcoes.antecedenciaMin ?? 0) * 60_000);
  const r: HorarioLivre[] = [];
  for (const p of profs) {
    const inicios = horariosLivres({
      expediente: await expedienteDoProfissional(tx, p.id, unidadeId, dia),
      ocupados: comFolga(
        await ocupadosDoProfissional(tx, p.id, dia, opcoes.ignorar),
        regras.intervaloMin,
      ),
      duracaoMin,
      passoMin: 15,
      agora: aPartirDe,
    });
    r.push({ profissionalId: p.id, inicios: inicios.map((d) => d.toISOString()) });
  }
  return r;
}

/** Confere expediente e choque de horário antes de gravar. */
export async function validarHorario(
  tx: Tx,
  profissionalId: string,
  unidadeId: string,
  inicio: Date,
  fim: Date,
  ignorar?: string,
): Promise<void> {
  const dia = dataLocal(inicio);
  const turnos = await expedienteDoProfissional(tx, profissionalId, unidadeId, dia);
  if (!turnos.some((t) => t.inicio <= inicio && fim <= t.fim))
    throw new ErroAgenda(
      'conflito',
      'Fora do expediente do profissional (ou a unidade não abre nesse dia).',
    );
  const regras = await regrasDaUnidade(tx, unidadeId);
  const ocupados = comFolga(
    await ocupadosDoProfissional(tx, profissionalId, dia, ignorar),
    regras.intervaloMin,
  );
  if (ocupados.some((o) => o.inicio < fim && inicio < o.fim))
    throw new ErroAgenda(
      'conflito',
      'Este profissional já tem um agendamento ou bloqueio nesse horário.',
    );
}

/** Duração somada dos serviços (ativos); confere que todos existem. */
export async function duracaoDosServicos(tx: Tx, servicoIds: readonly string[]): Promise<number> {
  const servicos = await tx.servico.findMany({
    where: { id: { in: [...servicoIds] }, ativo: true },
  });
  if (servicos.length !== new Set(servicoIds).size)
    throw new ErroAgenda('nao_encontrado', 'Serviço não encontrado.');
  return servicoIds.reduce((s, id) => s + servicos.find((x) => x.id === id)!.duracaoMin, 0);
}

export interface NovoAgendamentoNoBanco {
  unidadeId: string;
  profissionalId: string;
  clienteId: string;
  inicio: Date;
  servicoIds: readonly string[];
  origem: OrigemAgendamento;
  observacao?: string | null;
  criadoPorId: string | null;
  /** Encaixe confirmado pela recepção (fora do expediente ou em cima de bloqueio). */
  encaixe?: boolean;
}

/**
 * Cria o agendamento e a comanda prevista com os serviços e os preços do dia. Confere
 * serviços, preço, expediente, calendário, bloqueios e choque de horário (o banco também
 * impede sobreposição). Devolve a comanda.
 */
export async function criarAgendamentoNoBanco(
  tx: Tx,
  d: NovoAgendamentoNoBanco,
): Promise<{ comandaId: string; agendamentoId: string; fim: Date; total: number }> {
  const duracao = await duracaoDosServicos(tx, d.servicoIds);
  const fim = new Date(d.inicio.getTime() + duracao * 60_000);
  // Encaixe: a recepção já viu os avisos e confirmou; só outro cliente no horário impede.
  if (d.encaixe) await avisosDoEncaixe(tx, d.profissionalId, d.unidadeId, d.inicio, fim);
  else await validarHorario(tx, d.profissionalId, d.unidadeId, d.inicio, fim);
  const ag = await tx.agendamento.create({
    data: {
      unidadeId: d.unidadeId,
      profissionalId: d.profissionalId,
      clienteId: d.clienteId,
      inicio: d.inicio,
      fim,
      origem: d.origem,
      observacao: d.observacao ?? null,
      criadoPorId: d.criadoPorId,
    },
  });
  const comanda = await tx.comanda.create({
    data: {
      unidadeId: d.unidadeId,
      profissionalId: d.profissionalId,
      clienteId: d.clienteId,
      agendamentoId: ag.id,
      status: 'prevista',
    },
  });
  const dia = dataLocal(d.inicio);
  let total = 0;
  for (const servicoId of d.servicoIds) {
    const s = await tx.servico.findUniqueOrThrow({ where: { id: servicoId } });
    const preco = await precoServicoVigente(tx, s.id, d.unidadeId, dia);
    if (preco === undefined)
      throw new ErroAgenda(
        'sem_preco',
        `"${s.nome}" não tem preço nesta unidade. Defina na tabela de preços.`,
      );
    // Assinante do clube: o que o plano cobre entra com valor zero (RN-07).
    const partes = await partesDoServico(tx, {
      clienteId: d.clienteId,
      unidadeId: d.unidadeId,
      servicoId: s.id,
      quantidade: 1,
      preco,
      dia: dia as DataISO,
    });
    for (const p of partes) {
      await tx.itemComanda.create({
        data: {
          comandaId: comanda.id,
          tipo: 'servico',
          servicoId: s.id,
          profissionalId: d.profissionalId,
          quantidade: p.quantidade,
          precoUnitario: p.precoUnitario,
          cobertoClube: p.cobertoClube,
          adesaoId: p.adesaoId,
          custoUnitario: s.custoProduto,
          ehExtra: s.ehExtra,
          pesoAtendimento: s.pesoAtendimento,
        },
      });
      total += p.precoUnitario * p.quantidade;
    }
  }
  await tx.comanda.update({
    where: { id: comanda.id },
    data: { totalBruto: total, totalLiquido: total },
  });
  return { comandaId: comanda.id, agendamentoId: ag.id, fim, total };
}

/**
 * Muda o horário (e o profissional) de um agendamento que ainda não começou. Confere
 * expediente e choque, ignorando o próprio horário; a comanda prevista e os itens acompanham.
 */
export async function moverAgendamento(
  tx: Tx,
  agendamentoId: string,
  inicio: Date,
  profissionalId?: string,
) {
  const ag = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { comanda: true },
  });
  if (!ag) throw new ErroAgenda('nao_encontrado', 'Agendamento não encontrado.');
  if (!ag.comanda || ag.comanda.status !== 'prevista')
    throw new ErroAgenda('conflito', 'Só dá para remarcar antes de o atendimento começar.');
  const fim = new Date(inicio.getTime() + (ag.fim.getTime() - ag.inicio.getTime()));
  const prof = profissionalId ?? ag.profissionalId;
  await validarHorario(tx, prof, ag.unidadeId, inicio, fim, ag.id);
  // Horário novo: os lembretes do antigo e a confirmação deixam de valer.
  await tx.agendamento.update({
    where: { id: ag.id },
    data: {
      inicio,
      fim,
      profissionalId: prof,
      lembrete24hEm: null,
      lembrete2hEm: null,
      confirmadoEm: null,
      ...(ag.status === 'confirmado' ? { status: 'agendado' as const } : {}),
    },
  });
  await tx.comanda.update({ where: { id: ag.comanda.id }, data: { profissionalId: prof } });
  await tx.itemComanda.updateMany({
    where: { comandaId: ag.comanda.id, profissionalId: { not: null } },
    data: { profissionalId: prof },
  });
  return {
    antes: { inicio: ag.inicio, fim: ag.fim, profissionalId: ag.profissionalId },
    contaId: ag.contaId,
    comandaId: ag.comanda.id,
    unidadeId: ag.unidadeId,
  };
}

/**
 * O cliente cancelou (pela conversa ou pelo link): libera o horário e cancela a comanda
 * prevista sem contar como falta. Fica na auditoria sem usuário (foi o cliente).
 */
export async function cancelarPeloCliente(tx: Tx, agendamentoId: string, canal: string) {
  const ag = await tx.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { comanda: true },
  });
  if (!ag) throw new ErroAgenda('nao_encontrado', 'Agendamento não encontrado.');
  if (
    !['agendado', 'confirmado'].includes(ag.status) ||
    (ag.comanda && ag.comanda.status !== 'prevista')
  )
    throw new ErroAgenda('conflito', 'Este horário não pode mais ser cancelado por aqui.');
  const motivo = `Cancelado pelo cliente (${canal})`;
  await tx.agendamento.update({ where: { id: ag.id }, data: { status: 'cancelado' } });
  if (ag.comanda)
    await tx.comanda.update({
      where: { id: ag.comanda.id },
      data: { status: 'cancelada', canceladaEm: new Date(), motivoCancelamento: motivo },
    });
  await tx.auditoria.create({
    data: {
      usuarioId: null,
      entidade: 'agendamento',
      entidadeId: ag.id,
      acao: 'cancelar_pelo_cliente',
      antes: { status: ag.status, inicio: ag.inicio.toISOString() },
      depois: { status: 'cancelado' },
      motivo,
    },
  });
  // O horário que vagou (para a lista de espera).
  return {
    contaId: ag.contaId,
    unidadeId: ag.unidadeId,
    profissionalId: ag.profissionalId,
    inicio: ag.inicio,
    fim: ag.fim,
  };
}

/**
 * Os trabalhos de lembrete de um agendamento pelas horas da unidade (marcado ou remarcado
 * agora). A API e o worker põem na fila `whatsapp-entrada`.
 */
export async function lembretesDoAgendamento(
  tx: Tx,
  contaId: string,
  agendamentoId: string,
  agora = new Date(),
) {
  const ag = await tx.agendamento.findUnique({ where: { id: agendamentoId } });
  if (!ag) return [];
  const regras = await regrasDaUnidade(tx, ag.unidadeId);
  const trabalhos: {
    dados: LembreteDeHorario | ProximoClienteDaEquipe;
    atrasoMs: number;
    jobId: string;
  }[] = trabalhosDeLembrete(contaId, ag.id, ag.inicio, agora, agora, regras.lembretesHoras);
  // Assistente da equipe: "próximo cliente em 15 minutos" (o worker confere tudo na hora).
  const quando = momentoProximoCliente(ag.inicio, agora, agora);
  if (quando)
    trabalhos.push({
      dados: {
        tipo: 'proximo_cliente',
        contaId,
        agendamentoId: ag.id,
        inicio: ag.inicio.toISOString(),
      },
      atrasoMs: quando.getTime() - agora.getTime(),
      jobId: `proximo_${ag.id}_${ag.inicio.getTime()}`,
    });
  return trabalhos;
}

/** Faltas do cliente na janela da regra (todas as unidades da conta). */
export async function faltasRecentes(
  tx: Tx,
  clienteId: string,
  agora: Date,
  regras: Pick<RegrasAgendamento, 'faltasJanelaDias'>,
): Promise<number> {
  return tx.agendamento.count({
    where: {
      clienteId,
      status: 'falta',
      inicio: { gte: new Date(agora.getTime() - regras.faltasJanelaDias * 86_400_000), lt: agora },
    },
  });
}

/**
 * Primeiro horário possível do dia (abertura do expediente, ou agora com a antecedência,
 * arredondado para a grade de 15 min), livre ou não. null = ninguém atende no dia.
 */
export async function primeiroHorarioPossivel(
  tx: Tx,
  unidadeId: string,
  profissionalIds: readonly string[],
  dia: string,
  agora: Date,
  antecedenciaMin: number,
): Promise<string | null> {
  let primeiro: number | null = null;
  for (const id of profissionalIds) {
    const turnos = await expedienteDoProfissional(tx, id, unidadeId, dia).catch(() => []);
    for (const t of turnos) primeiro = Math.min(primeiro ?? Infinity, t.inicio.getTime());
  }
  if (primeiro === null) return null;
  const passo = 15 * 60_000;
  const minimo = Math.ceil((agora.getTime() + antecedenciaMin * 60_000) / passo) * passo;
  return new Date(Math.max(primeiro, minimo)).toISOString();
}

// Agenda: expediente, horários livres e criação do agendamento com a comanda prevista.
// Fonte única para o balcão (API), o link público (API) e o bot (worker).
import {
  dataLocal,
  diaDaSemana,
  horariosLivres,
  instanteLocal,
  type HorarioLivre,
} from '@pente-fino/shared';
import type { OrigemAgendamento, Prisma } from './generated/prisma/client.js';
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
  const bls = await tx.bloqueioAgenda.findMany({
    where: { profissionalId, inicio: { lt: fim }, fim: { gt: inicio } },
  });
  return [...ags, ...bls].map((x) => ({ inicio: x.inicio, fim: x.fim }));
}

/** Horários livres de cada profissional ativo da unidade (ou de um só) no dia. */
export async function calcularLivres(
  tx: Tx,
  unidadeId: string,
  dia: string,
  duracaoMin: number,
  profissionalId?: string,
  agora = new Date(),
): Promise<HorarioLivre[]> {
  const profs = await tx.profissional.findMany({
    where: { unidadeId, ativo: true, ...(profissionalId ? { id: profissionalId } : {}) },
  });
  const r: HorarioLivre[] = [];
  for (const p of profs) {
    const inicios = horariosLivres({
      expediente: await expedienteDoProfissional(tx, p.id, unidadeId, dia),
      ocupados: await ocupadosDoProfissional(tx, p.id, dia),
      duracaoMin,
      passoMin: 15,
      agora,
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
  const ocupados = await ocupadosDoProfissional(tx, profissionalId, dia, ignorar);
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
  await validarHorario(tx, d.profissionalId, d.unidadeId, d.inicio, fim);
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
    await tx.itemComanda.create({
      data: {
        comandaId: comanda.id,
        tipo: 'servico',
        servicoId: s.id,
        profissionalId: d.profissionalId,
        quantidade: 1,
        precoUnitario: preco,
        custoUnitario: s.custoProduto,
        ehExtra: s.ehExtra,
        pesoAtendimento: s.pesoAtendimento,
      },
    });
    total += preco;
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
  await tx.agendamento.update({
    where: { id: ag.id },
    data: { inicio, fim, profissionalId: prof },
  });
  await tx.comanda.update({ where: { id: ag.comanda.id }, data: { profissionalId: prof } });
  await tx.itemComanda.updateMany({
    where: { comandaId: ag.comanda.id, profissionalId: { not: null } },
    data: { profissionalId: prof },
  });
  return {
    antes: { inicio: ag.inicio, profissionalId: ag.profissionalId },
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
}

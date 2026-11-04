import { Inject, Injectable } from '@nestjs/common';
import type { Transacao } from '@pente-fino/db';
import {
  dataLocal,
  diaDaSemana,
  horariosLivres,
  instanteLocal,
  podeNaUnidade,
  statusEfetivo,
  type Agenda,
  type HorarioLivre,
  type NovoAgendamentoEntrada,
  type StatusComanda,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade } from '../comum/escopo.js';
import { ComandasService } from '../comandas/comandas.service.js';
import { EventosService } from '../filas/filas.module.js';

const BALCAO = ['dono', 'gestor', 'recepcao'] as const;

function somarDias(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

@Injectable()
export class AgendaService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(ComandasService) private readonly comandas: ComandasService,
    @Inject(EventosService) private readonly eventos: EventosService,
  ) {}

  /** Agenda da unidade no período. Barbeiro vê só a própria coluna. */
  async agenda(unidadeId: string, de: string, ate: string): Promise<Agenda> {
    if (
      ate < de ||
      (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) /
        86_400_000 >
        42
    ) {
      throw Erros.validacao([{ campo: 'ate', mensagem: 'Período de até 6 semanas.' }]);
    }
    const quem = Contexto.usuario();
    const soEle = !podeNaUnidade(quem.papeis, unidadeId, [...BALCAO]);
    const inicio = new Date(`${de}T00:00:00-03:00`);
    const fim = new Date(`${somarDias(ate, 1)}T00:00:00-03:00`);
    return this.banco.daConta(async (tx) => {
      const unidade = await tx.unidade.findUnique({ where: { id: unidadeId } });
      if (!unidade) throw Erros.naoEncontrado('Unidade não encontrada.');
      const profissionais = await tx.profissional.findMany({
        where: { unidadeId, ativo: true, ...(soEle ? { usuarioId: quem.id } : {}) },
        include: { usuario: true, horarios: true },
        orderBy: { usuario: { nome: 'asc' } },
      });
      const ids = profissionais.map((p) => p.id);
      const [agendamentos, bloqueios, calendario] = await Promise.all([
        tx.agendamento.findMany({
          where: {
            profissionalId: { in: ids },
            inicio: { gte: inicio, lt: fim },
            status: { notIn: ['cancelado'] },
          },
          include: {
            cliente: true,
            comanda: { include: { itens: { include: { servico: true } } } },
          },
          orderBy: { inicio: 'asc' },
        }),
        tx.bloqueioAgenda.findMany({
          where: { profissionalId: { in: ids }, inicio: { lt: fim }, fim: { gt: inicio } },
        }),
        tx.calendarioUnidade.findMany({
          where: { unidadeId, data: { gte: data(de), lte: data(ate) } },
        }),
      ]);
      const agora = new Date();
      return {
        profissionais: profissionais.map((p) => ({
          id: p.id,
          nome: p.usuario.nome,
          horarios: p.horarios.map((h) => ({
            diaSemana: h.diaSemana,
            inicioMin: h.inicioMin,
            fimMin: h.fimMin,
          })),
        })),
        itens: agendamentos.map((a) => ({
          agendamentoId: a.id,
          comandaId: a.comanda?.id ?? null,
          profissionalId: a.profissionalId,
          cliente: a.cliente?.nome ?? 'Cliente',
          servicos:
            a.comanda?.itens
              .filter((i) => i.tipo === 'servico')
              .map((i) => i.servico?.nome ?? 'Serviço') ?? [],
          inicio: a.inicio.toISOString(),
          fim: a.fim.toISOString(),
          status:
            a.status === 'falta'
              ? 'cancelada'
              : statusEfetivo((a.comanda?.status ?? 'prevista') as StatusComanda, a.fim, agora),
          origem: a.origem,
        })),
        bloqueios: bloqueios.map((b) => ({
          id: b.id,
          profissionalId: b.profissionalId,
          inicio: b.inicio.toISOString(),
          fim: b.fim.toISOString(),
          motivo: b.motivo,
        })),
        fechados: calendario.filter((c) => !c.trabalha).map((c) => dataTexto(c.data)),
        diasTrabalho: unidade.diasTrabalho,
      };
    });
  }

  /** Expediente do profissional no dia, respeitando dias da unidade e o calendário. */
  private async expediente(tx: Transacao, profissionalId: string, unidadeId: string, dia: string) {
    const [prof, unidade, excecao] = await Promise.all([
      tx.profissional.findUnique({ where: { id: profissionalId }, include: { horarios: true } }),
      tx.unidade.findUnique({ where: { id: unidadeId } }),
      tx.calendarioUnidade.findUnique({
        where: { unidadeId_data: { unidadeId, data: data(dia) } },
      }),
    ]);
    if (!prof || prof.unidadeId !== unidadeId || !prof.ativo)
      throw Erros.naoEncontrado('Profissional não encontrado nesta unidade.');
    if (prof.dataSaida && dataTexto(prof.dataSaida) < dia) return [];
    const ds = diaDaSemana(dia);
    const abre = excecao ? excecao.trabalha : !!unidade?.diasTrabalho.includes(ds);
    if (!abre) return [];
    return prof.horarios
      .filter((h) => h.diaSemana === ds)
      .map((h) => ({ inicio: instanteLocal(dia, h.inicioMin), fim: instanteLocal(dia, h.fimMin) }));
  }

  private async ocupados(tx: Transacao, profissionalId: string, dia: string, ignorar?: string) {
    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(inicio.getTime() + 86_400_000);
    const [ags, bls] = await Promise.all([
      tx.agendamento.findMany({
        where: {
          profissionalId,
          inicio: { lt: fim },
          fim: { gt: inicio },
          status: { notIn: ['cancelado', 'falta'] },
          ...(ignorar ? { id: { not: ignorar } } : {}),
        },
      }),
      tx.bloqueioAgenda.findMany({
        where: { profissionalId, inicio: { lt: fim }, fim: { gt: inicio } },
      }),
    ]);
    return [...ags, ...bls].map((x) => ({ inicio: x.inicio, fim: x.fim }));
  }

  async livres(
    unidadeId: string,
    dia: string,
    duracaoMin: number,
    profissionalId?: string,
  ): Promise<HorarioLivre[]> {
    return this.banco.daConta(async (tx) => {
      const profs = await tx.profissional.findMany({
        where: { unidadeId, ativo: true, ...(profissionalId ? { id: profissionalId } : {}) },
      });
      const r: HorarioLivre[] = [];
      for (const p of profs) {
        const inicios = horariosLivres({
          expediente: await this.expediente(tx, p.id, unidadeId, dia),
          ocupados: await this.ocupados(tx, p.id, dia),
          duracaoMin,
          passoMin: 15,
          agora: new Date(),
        });
        r.push({ profissionalId: p.id, inicios: inicios.map((d) => d.toISOString()) });
      }
      return r;
    });
  }

  private async validarHorario(
    tx: Transacao,
    profissionalId: string,
    unidadeId: string,
    inicio: Date,
    fim: Date,
    ignorar?: string,
  ) {
    const dia = dataLocal(inicio);
    const turnos = await this.expediente(tx, profissionalId, unidadeId, dia);
    if (!turnos.some((t) => t.inicio <= inicio && fim <= t.fim)) {
      throw Erros.conflito('Fora do expediente do profissional (ou a unidade não abre nesse dia).');
    }
    const ocupados = await this.ocupados(tx, profissionalId, dia, ignorar);
    if (ocupados.some((o) => o.inicio < fim && inicio < o.fim))
      throw Erros.conflito('Este profissional já tem um agendamento ou bloqueio nesse horário.');
  }

  async agendar(d: NovoAgendamentoEntrada) {
    exigirUnidade(d.unidadeId, [...BALCAO]);
    const quem = Contexto.usuario();
    const inicio = new Date(d.inicio);
    const comandaId = await this.banco.daConta(async (tx) => {
      const servicos = await tx.servico.findMany({
        where: { id: { in: d.servicoIds }, ativo: true },
      });
      if (servicos.length !== new Set(d.servicoIds).size)
        throw Erros.naoEncontrado('Serviço não encontrado.');
      const duracao = d.servicoIds.reduce(
        (s, id) => s + servicos.find((x) => x.id === id)!.duracaoMin,
        0,
      );
      const fim = new Date(inicio.getTime() + duracao * 60_000);
      await this.validarHorario(tx, d.profissionalId, d.unidadeId, inicio, fim);
      if (d.clienteId && !(await tx.cliente.findUnique({ where: { id: d.clienteId } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      const clienteId =
        d.clienteId ?? (await this.comandas.clienteNovo(tx, d.clienteNovo!, d.unidadeId));
      const ag = await tx.agendamento.create({
        data: {
          unidadeId: d.unidadeId,
          profissionalId: d.profissionalId,
          clienteId,
          inicio,
          fim,
          origem: d.origem,
          observacao: d.observacao ?? null,
          criadoPorId: quem.id,
        },
      });
      const comanda = await tx.comanda.create({
        data: {
          unidadeId: d.unidadeId,
          profissionalId: d.profissionalId,
          clienteId,
          agendamentoId: ag.id,
          status: 'prevista',
        },
      });
      for (const servicoId of d.servicoIds)
        await this.comandas.criarItem(tx, comanda, dataLocal(inicio), {
          tipo: 'servico',
          servicoId,
          quantidade: 1,
        });
      const itens = await tx.itemComanda.findMany({ where: { comandaId: comanda.id } });
      const bruto = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
      await tx.comanda.update({
        where: { id: comanda.id },
        data: { totalBruto: bruto, totalLiquido: bruto },
      });
      return comanda.id;
    });
    await this.eventos
      .publicar('agendamento.criado', quem.contaId, { comandaId })
      .catch(() => undefined);
    return this.comandas.buscar(comandaId);
  }

  async remarcar(agendamentoId: string, novoInicio: string, profissionalId?: string) {
    const comandaId = await this.banco.daConta(async (tx) => {
      const ag = await tx.agendamento.findUnique({
        where: { id: agendamentoId },
        include: { comanda: true },
      });
      if (!ag) throw Erros.naoEncontrado('Agendamento não encontrado.');
      exigirUnidade(ag.unidadeId, [...BALCAO]);
      if (!ag.comanda || ag.comanda.status !== 'prevista')
        throw Erros.conflito('Só dá para remarcar antes de o atendimento começar.');
      const inicio = new Date(novoInicio);
      const fim = new Date(inicio.getTime() + (ag.fim.getTime() - ag.inicio.getTime()));
      const prof = profissionalId ?? ag.profissionalId;
      await this.validarHorario(tx, prof, ag.unidadeId, inicio, fim, ag.id);
      await tx.agendamento.update({
        where: { id: ag.id },
        data: { inicio, fim, profissionalId: prof },
      });
      await tx.comanda.update({ where: { id: ag.comanda.id }, data: { profissionalId: prof } });
      await tx.itemComanda.updateMany({
        where: { comandaId: ag.comanda.id, profissionalId: { not: null } },
        data: { profissionalId: prof },
      });
      await auditar(tx, {
        entidade: 'agendamento',
        entidadeId: ag.id,
        acao: 'remarcar',
        antes: { inicio: ag.inicio, profissionalId: ag.profissionalId },
        depois: { inicio, profissionalId: prof },
      });
      return ag.comanda.id;
    });
    return this.comandas.buscar(comandaId);
  }
}

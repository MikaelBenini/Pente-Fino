import { Inject, Injectable } from '@nestjs/common';
import {
  calcularLivres,
  criarAgendamentoNoBanco,
  duracaoDosServicos,
  ErroAgenda,
  moverAgendamento,
  validarHorario,
  type Transacao,
} from '@pente-fino/db';
import {
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
import { emSequencia } from '../comum/sequencia.js';

const BALCAO = ['dono', 'gestor', 'recepcao'] as const;

function somarDias(d: string, n: number) {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Regra da agenda (packages/db) → resposta HTTP. */
async function traduzir<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErroAgenda) {
      if (e.codigo === 'nao_encontrado') throw Erros.naoEncontrado(e.message);
      if (e.codigo === 'sem_preco') throw Erros.requisicaoInvalida('sem_preco', e.message);
      throw Erros.conflito(e.message);
    }
    throw e;
  }
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
      const [agendamentos, bloqueios, calendario] = await emSequencia([
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

  async livres(
    unidadeId: string,
    dia: string,
    duracaoMin: number,
    profissionalId?: string,
  ): Promise<HorarioLivre[]> {
    return this.banco.daConta((tx) =>
      this.calcularLivres(tx, unidadeId, dia, duracaoMin, profissionalId),
    );
  }

  /** Horários livres numa transação já aberta (tela interna ou link público). */
  async calcularLivres(
    tx: Transacao,
    unidadeId: string,
    dia: string,
    duracaoMin: number,
    profissionalId?: string,
  ): Promise<HorarioLivre[]> {
    return traduzir(() => calcularLivres(tx, unidadeId, dia, duracaoMin, profissionalId));
  }

  private validarHorario(
    tx: Transacao,
    profissionalId: string,
    unidadeId: string,
    inicio: Date,
    fim: Date,
    ignorar?: string,
  ) {
    return traduzir(() => validarHorario(tx, profissionalId, unidadeId, inicio, fim, ignorar));
  }

  async agendar(d: NovoAgendamentoEntrada) {
    exigirUnidade(d.unidadeId, [...BALCAO]);
    const quem = Contexto.usuario();
    const comandaId = await this.banco.daConta((tx) => this.criarAgendamento(tx, d, quem.id));
    await this.eventos
      .publicar('agendamento.criado', quem.contaId, { comandaId })
      .catch(() => undefined);
    return this.comandas.buscar(comandaId);
  }

  /**
   * Cria agendamento + comanda prevista com os serviços e preços do dia. Confere
   * serviços, expediente, calendário, bloqueios e choque de horário. Devolve a comanda.
   */
  async criarAgendamento(
    tx: Transacao,
    d: NovoAgendamentoEntrada,
    criadoPorId: string | null,
  ): Promise<string> {
    if (d.clienteId && !(await tx.cliente.findUnique({ where: { id: d.clienteId } })))
      throw Erros.naoEncontrado('Cliente não encontrado.');
    // Confere serviços e horário antes de cadastrar cliente novo.
    const duracao = await traduzir(() => duracaoDosServicos(tx, d.servicoIds));
    const inicio = new Date(d.inicio);
    await this.validarHorario(
      tx,
      d.profissionalId,
      d.unidadeId,
      inicio,
      new Date(inicio.getTime() + duracao * 60_000),
    );
    const clienteId =
      d.clienteId ?? (await this.comandas.clienteNovo(tx, d.clienteNovo!, d.unidadeId));
    const r = await traduzir(() =>
      criarAgendamentoNoBanco(tx, {
        unidadeId: d.unidadeId,
        profissionalId: d.profissionalId,
        clienteId,
        inicio,
        servicoIds: d.servicoIds,
        origem: d.origem,
        observacao: d.observacao ?? null,
        criadoPorId,
      }),
    );
    return r.comandaId;
  }

  async remarcar(agendamentoId: string, novoInicio: string, profissionalId?: string) {
    const comandaId = await this.banco.daConta(async (tx) => {
      const ag = await tx.agendamento.findUnique({ where: { id: agendamentoId } });
      if (!ag) throw Erros.naoEncontrado('Agendamento não encontrado.');
      exigirUnidade(ag.unidadeId, [...BALCAO]);
      const inicio = new Date(novoInicio);
      const r = await traduzir(() => moverAgendamento(tx, ag.id, inicio, profissionalId));
      await auditar(tx, {
        entidade: 'agendamento',
        entidadeId: ag.id,
        acao: 'remarcar',
        antes: r.antes,
        depois: { inicio, profissionalId: profissionalId ?? ag.profissionalId },
      });
      return r.comandaId;
    });
    return this.comandas.buscar(comandaId);
  }
}

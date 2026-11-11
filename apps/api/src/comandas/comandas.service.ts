import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  agendarPesquisa,
  regrasDaUnidade,
  validarHorario,
  comissaoFixaDoClube,
  partesDoServico,
  precoServicoVigente,
  regraComissaoVigente,
  type Transacao,
} from '@pente-fino/db';
import {
  comissaoDoClube,
  DESFAZER_NAO_VEIO_MIN,
  estaAtrasado,
  comissaoItem,
  dataLocal,
  faltaReceber,
  formatarDataHora,
  formatarMoeda,
  papeisNaUnidade,
  podeAgirNaComanda,
  ratearDesconto,
  statusEfetivo,
  totaisComanda,
  valorItem,
  type AcaoComanda,
  type ComandaDetalhe,
  type ComandaResumo,
  type DataISO,
  type FecharComandaEntrada,
  type NovaComandaEntrada,
  type NovoItemEntrada,
  type StatusComanda,
} from '@pente-fino/shared';
import type { z } from 'zod';
import type { alterarItemSchema } from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { ErroApp, Erros } from '../comum/erros.js';
import { data, exigirUnidade } from '../comum/escopo.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { pdfComandas } from './impressao.js';
import { umPorVez } from '../comum/sequencia.js';
import { avisarEquipe, avisarFalta, liberarVaga } from '../agenda/aviso-equipe.js';
import { EventosService, Filas } from '../filas/filas.module.js';

const INCLUIR = {
  itens: { include: { servico: true, produto: true }, orderBy: { criadoEm: 'asc' as const } },
  pagamentos: true,
  cliente: true,
  profissional: { include: { usuario: true } },
  agendamento: true,
} as const;

type ComandaCompleta = NonNullable<Awaited<ReturnType<Transacao['comanda']['findUnique']>>> & {
  itens: {
    id: string;
    tipo: 'servico' | 'produto' | 'nao_operacional';
    servicoId: string | null;
    produtoId: string | null;
    descricao: string | null;
    quantidade: number;
    precoUnitario: number;
    desconto: number;
    ehExtra: boolean;
    comissaoValor: number;
    custoUnitario: number;
    pesoAtendimento: number;
    profissionalId: string | null;
    cobertoClube: boolean;
    adesaoId: string | null;
    servico: { nome: string } | null;
    produto: { nome: string } | null;
  }[];
  pagamentos: { forma: 'dinheiro' | 'pix' | 'debito' | 'credito' | 'clube'; valor: number }[];
  cliente: { id: string; nome: string } | null;
  profissional: { id: string; usuarioId: string; usuario: { nome: string } };
  agendamento: { id: string; inicio: Date; fim: Date } | null;
};

/** Dia (São Paulo) em que a comanda acontece: o do horário marcado ou o da abertura. */
export function diaDaComanda(c: { agendamento: { inicio: Date } | null; criadoEm: Date }): string {
  return dataLocal(c.agendamento?.inicio ?? c.criadoEm);
}

function nomeItem(i: ComandaCompleta['itens'][number]): string {
  return i.servico?.nome ?? i.produto?.nome ?? i.descricao ?? 'Item';
}

export function resumo(c: ComandaCompleta, agora = new Date()): ComandaResumo {
  return {
    id: c.id,
    unidadeId: c.unidadeId,
    profissionalId: c.profissionalId,
    profissional: c.profissional.usuario.nome,
    cliente: c.cliente?.nome ?? null,
    clienteId: c.clienteId,
    status: statusEfetivo(c.status as StatusComanda, c.agendamento?.fim ?? null, agora),
    inicio: (c.agendamento?.inicio ?? c.iniciadaEm)?.toISOString() ?? null,
    fim: c.agendamento?.fim.toISOString() ?? null,
    totalLiquido: c.totalLiquido,
    servicos: c.itens.filter((i) => i.tipo === 'servico').map(nomeItem),
  };
}

function detalhe(c: ComandaCompleta): Omit<ComandaDetalhe, 'atrasado' | 'podeDesfazerNaoVeio'> {
  return {
    ...resumo(c),
    agendamentoId: c.agendamentoId,
    totalBruto: c.totalBruto,
    desconto: c.desconto,
    itens: c.itens.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      servicoId: i.servicoId,
      produtoId: i.produtoId,
      descricao: nomeItem(i),
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      desconto: i.desconto,
      ehExtra: i.ehExtra,
      cobertoClube: i.cobertoClube,
      comissaoValor: i.comissaoValor,
    })),
    pagamentos: c.pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
    fechadaEm: c.fechadaEm?.toISOString() ?? null,
    motivoCancelamento: c.motivoCancelamento,
  };
}

@Injectable()
export class ComandasService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(EventosService) private readonly eventos: EventosService,
    @Inject(Filas) private readonly filas: Filas,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  /** Carrega e confere o acesso. Sem acesso, responde "não encontrada" (não revela que existe). */
  async carregar(
    tx: Transacao,
    id: string,
  ): Promise<{
    comanda: ComandaCompleta;
    propria: boolean;
    papeis: ReturnType<typeof papeisNaUnidade>;
  }> {
    const comanda = (await tx.comanda.findUnique({
      where: { id },
      include: INCLUIR,
    })) as ComandaCompleta | null;
    if (!comanda) throw Erros.naoEncontrado('Comanda não encontrada.');
    const quem = Contexto.usuario();
    const papeis = papeisNaUnidade(quem.papeis, comanda.unidadeId);
    const propria = comanda.profissional.usuarioId === quem.id;
    const balcao = papeis.some((p) => p !== 'barbeiro');
    if (!balcao && !(papeis.includes('barbeiro') && propria))
      throw Erros.naoEncontrado('Comanda não encontrada.');
    return { comanda, propria, papeis };
  }

  private exigir(
    acao: AcaoComanda,
    c: ComandaCompleta,
    papeis: ReturnType<typeof papeisNaUnidade>,
    propria: boolean,
  ) {
    const status = statusEfetivo(c.status as StatusComanda, c.agendamento?.fim ?? null, new Date());
    const v = podeAgirNaComanda(acao, status, papeis, propria);
    if (!v.permitido) throw Erros.requisicaoInvalida('acao_nao_permitida', v.motivo!);
    return status;
  }

  /** PDF das comandas do dia (previstas e abertas primeiro, na ordem do horário). */
  async impressao(unidadeId: string, dia: string, porFolha: 4 | 6): Promise<Uint8Array> {
    exigirUnidade(unidadeId, ['dono', 'gestor', 'recepcao']);
    const lista = await this.listar({ unidadeId, data: dia });
    const ativas = lista.filter((c) => c.status !== 'cancelada');
    const detalhes = await this.banco.daConta(async (tx) => {
      const unidade = await tx.unidade.findUnique({ where: { id: unidadeId } });
      if (!unidade) throw Erros.naoEncontrado('Unidade não encontrada.');
      return {
        unidade,
        comandas: await umPorVez(ativas, async (c) =>
          detalhe((await this.carregar(tx, c.id)).comanda),
        ),
      };
    });
    return pdfComandas(
      detalhes.comandas.map((c, i) => ({
        id: c.id,
        numero: i + 1,
        unidade: detalhes.unidade.nome,
        inicio: c.inicio ? new Date(c.inicio) : null,
        cliente: c.cliente ?? 'Cliente',
        profissional: c.profissional,
        itens: c.itens.map((it) => ({
          descricao: it.quantidade > 1 ? `${it.quantidade}× ${it.descricao}` : it.descricao,
          valor: it.quantidade * it.precoUnitario - it.desconto,
        })),
        total: c.totalLiquido,
      })),
      porFolha,
      (id) => `${this.config.appUrl}/comandas?id=${id}`,
      `Comandas ${dia}`,
    );
  }

  async buscar(id: string): Promise<ComandaDetalhe> {
    return this.banco.daConta(async (tx) => {
      const c = (await this.carregar(tx, id)).comanda;
      const ag = c.agendamentoId
        ? await tx.agendamento.findUnique({ where: { id: c.agendamentoId } })
        : null;
      const agora = new Date();
      const regras = ag ? await regrasDaUnidade(tx, c.unidadeId) : null;
      return {
        ...detalhe(c),
        atrasado:
          !!ag &&
          estaAtrasado({
            statusComanda: c.status,
            statusAgendamento: ag.status,
            inicio: ag.inicio,
            agora,
            toleranciaMin: regras!.toleranciaAtrasoMin,
          }),
        podeDesfazerNaoVeio:
          !!ag?.atrasou &&
          ag.status === 'falta' &&
          !!c.canceladaEm &&
          agora.getTime() - c.canceladaEm.getTime() <= DESFAZER_NAO_VEIO_MIN * 60_000,
      };
    });
  }

  /**
   * Passou da tolerância e o cliente não veio (confirmado pelo barbeiro ou pela recepção):
   * cancela como atraso (conta nas faltas, separado da falta comum). A remarcação para o
   * cliente e a vaga para a lista saem em 5 min, para dar tempo de desfazer.
   */
  async naoVeio(id: string): Promise<ComandaDetalhe> {
    const contaId = Contexto.usuario().contaId;
    const agendamentoId = await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('nao_veio', comanda, papeis, propria);
      const ag = comanda.agendamentoId
        ? await tx.agendamento.findUnique({ where: { id: comanda.agendamentoId } })
        : null;
      if (!ag)
        throw Erros.requisicaoInvalida('sem_horario', 'Esta comanda não tem horário marcado.');
      const regras = await regrasDaUnidade(tx, comanda.unidadeId);
      if (
        !estaAtrasado({
          statusComanda: comanda.status,
          statusAgendamento: ag.status,
          inicio: ag.inicio,
          agora: new Date(),
          toleranciaMin: regras.toleranciaAtrasoMin,
        })
      )
        throw Erros.conflito(
          `Ainda dentro da tolerância de ${regras.toleranciaAtrasoMin} minutos. Espere um pouco mais.`,
        );
      await tx.comanda.update({
        where: { id },
        data: {
          status: 'cancelada',
          canceladaEm: new Date(),
          motivoCancelamento: 'Não veio (atraso)',
        },
      });
      await tx.agendamento.update({
        where: { id: ag.id },
        data: { status: 'falta', atrasou: true },
      });
      await auditar(tx, {
        entidade: 'comanda',
        entidadeId: id,
        acao: 'nao_veio',
        antes: { status: comanda.status },
        depois: { status: 'cancelada', atraso: true },
        motivo: 'Não veio (atraso)',
      });
      await liberarVaga(this.filas, contaId, ag, DESFAZER_NAO_VEIO_MIN * 60_000);
      return ag.id;
    });
    await this.filas.whatsappEntrada
      .add(
        'atraso',
        { tipo: 'atraso', contaId, agendamentoId },
        { delay: DESFAZER_NAO_VEIO_MIN * 60_000, jobId: `atraso_${agendamentoId}_${Date.now()}` },
      )
      .catch(() => undefined);
    return this.buscar(id);
  }

  /** Desfazer o "Não veio" em até 5 min (o cliente chegou): volta o horário, se ainda está livre. */
  async desfazerNaoVeio(id: string): Promise<ComandaDetalhe> {
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      if (!podeAgirNaComanda('editar_itens', 'prevista', papeis, propria).permitido)
        throw Erros.semPermissao();
      const ag = comanda.agendamentoId
        ? await tx.agendamento.findUnique({ where: { id: comanda.agendamentoId } })
        : null;
      if (
        !ag?.atrasou ||
        ag.status !== 'falta' ||
        comanda.status !== 'cancelada' ||
        !comanda.canceladaEm ||
        Date.now() - comanda.canceladaEm.getTime() > DESFAZER_NAO_VEIO_MIN * 60_000
      )
        throw Erros.conflito('Passou o tempo para desfazer. Marque um horário novo.');
      // O horário já era do cliente: só confere se ninguém ocupou a vaga nesses minutos (o
      // expediente pode ter acabado, e isso não impede desfazer).
      await validarHorario(tx, ag.profissionalId, ag.unidadeId, ag.inicio, ag.fim, ag.id, {
        conferirExpediente: false,
      }).catch((e: Error) => {
        throw Erros.conflito(`O horário não está mais livre: ${e.message}`);
      });
      await tx.agendamento.update({
        where: { id: ag.id },
        data: { status: 'agendado', atrasou: false },
      });
      await tx.comanda.update({
        where: { id },
        data: { status: 'prevista', canceladaEm: null, motivoCancelamento: null },
      });
      await auditar(tx, {
        entidade: 'comanda',
        entidadeId: id,
        acao: 'desfazer_nao_veio',
        antes: { status: 'cancelada' },
        depois: { status: 'prevista' },
      });
    });
    return this.buscar(id);
  }

  /** Recalcula os totais a partir dos itens. */
  private async atualizarTotais(tx: Transacao, id: string) {
    const itens = await tx.itemComanda.findMany({ where: { comandaId: id } });
    const t = totaisComanda(itens);
    await tx.comanda.update({ where: { id }, data: t });
  }

  /** Cria o item gravando preço, custo, peso e extra do momento. */
  async criarItem(
    tx: Transacao,
    c: { id: string; unidadeId: string; profissionalId: string; clienteId: string | null },
    dia: string,
    item: NovoItemEntrada,
  ) {
    if (item.tipo === 'servico') {
      const s = await tx.servico.findUnique({ where: { id: item.servicoId } });
      if (!s || !s.ativo) throw Erros.naoEncontrado('Serviço não encontrado.');
      const preco = await precoServicoVigente(tx, s.id, c.unidadeId, dia);
      if (preco === undefined)
        throw Erros.requisicaoInvalida(
          'sem_preco',
          `"${s.nome}" não tem preço nesta unidade. Defina na tabela de preços.`,
        );
      // Assinante do clube: o que o plano cobre entra com valor zero; o resto, preço normal.
      const partes = await partesDoServico(tx, {
        clienteId: c.clienteId,
        unidadeId: c.unidadeId,
        servicoId: s.id,
        quantidade: item.quantidade,
        preco,
        dia: dia as DataISO,
      });
      let criado;
      for (const p of partes)
        criado = await tx.itemComanda.create({
          data: {
            comandaId: c.id,
            tipo: 'servico',
            servicoId: s.id,
            profissionalId: c.profissionalId,
            quantidade: p.quantidade,
            precoUnitario: p.precoUnitario,
            cobertoClube: p.cobertoClube,
            adesaoId: p.adesaoId,
            custoUnitario: s.custoProduto,
            ehExtra: s.ehExtra,
            pesoAtendimento: s.pesoAtendimento,
          },
        });
      return criado!;
    }
    if (item.tipo === 'produto') {
      const p = await tx.produto.findUnique({ where: { id: item.produtoId } });
      if (!p || !p.ativo) throw Erros.naoEncontrado('Produto não encontrado.');
      return tx.itemComanda.create({
        data: {
          comandaId: c.id,
          tipo: 'produto',
          produtoId: p.id,
          profissionalId: c.profissionalId,
          quantidade: item.quantidade,
          precoUnitario: p.precoVenda,
          custoUnitario: p.custo,
        },
      });
    }
    return tx.itemComanda.create({
      data: {
        comandaId: c.id,
        tipo: 'nao_operacional',
        descricao: item.descricao,
        quantidade: 1,
        precoUnitario: item.valor,
      },
    });
  }

  async listar(filtro: {
    unidadeId?: string;
    data?: string;
    status?: string;
  }): Promise<ComandaResumo[]> {
    const quem = Contexto.usuario();
    const dia = filtro.data ?? dataLocal(new Date());
    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(inicio.getTime() + 86_400_000);
    const status = filtro.status?.split(',').filter(Boolean);
    return this.banco.daConta(async (tx) => {
      const comandas = (await tx.comanda.findMany({
        where: {
          ...(filtro.unidadeId ? { unidadeId: filtro.unidadeId } : {}),
          OR: [
            { agendamento: { inicio: { gte: inicio, lt: fim } } },
            { agendamentoId: null, criadoEm: { gte: inicio, lt: fim } },
          ],
        },
        include: INCLUIR,
        orderBy: { criadoEm: 'asc' },
      })) as ComandaCompleta[];
      const agora = new Date();
      return comandas
        .filter((c) => {
          const papeis = papeisNaUnidade(quem.papeis, c.unidadeId);
          if (papeis.some((p) => p !== 'barbeiro')) return true;
          return papeis.includes('barbeiro') && c.profissional.usuarioId === quem.id;
        })
        .map((c) => resumo(c, agora))
        .filter((c) => !status || status.includes(c.status))
        .sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? ''));
    });
  }

  /** Cliente chegou sem horário: comanda aberta na hora, já em atendimento. */
  async abrir(d: NovaComandaEntrada): Promise<ComandaDetalhe> {
    const id = await this.banco.daConta(async (tx) => {
      const prof = await tx.profissional.findUnique({ where: { id: d.profissionalId } });
      if (!prof || prof.unidadeId !== d.unidadeId || !prof.ativo)
        throw Erros.naoEncontrado('Profissional não encontrado nesta unidade.');
      const clienteId = d.clienteId ?? (await this.clienteNovo(tx, d.clienteNovo!, d.unidadeId));
      if (d.clienteId && !(await tx.cliente.findUnique({ where: { id: d.clienteId } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      const c = await tx.comanda.create({
        data: {
          unidadeId: d.unidadeId,
          profissionalId: d.profissionalId,
          clienteId,
          status: 'em_atendimento',
          iniciadaEm: new Date(),
        },
      });
      for (const servicoId of d.servicoIds)
        await this.criarItem(tx, c, dataLocal(new Date()), {
          tipo: 'servico',
          servicoId,
          quantidade: 1,
        });
      await this.atualizarTotais(tx, c.id);
      return c.id;
    });
    return this.buscar(id);
  }

  /** Cria cliente (telefone repetido na conta reaproveita o cadastro). */
  async clienteNovo(
    tx: Transacao,
    novo: { nome: string; telefone?: string | null },
    unidadeId: string,
  ): Promise<string> {
    if (novo.telefone) {
      const existente = await tx.cliente.findFirst({ where: { telefone: novo.telefone } });
      if (existente) return existente.id;
    }
    const c = await tx.cliente.create({
      data: { nome: novo.nome, telefone: novo.telefone ?? null, unidadeOrigemId: unidadeId },
    });
    return c.id;
  }

  async adicionarItem(id: string, item: NovoItemEntrada): Promise<ComandaDetalhe> {
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('editar_itens', comanda, papeis, propria);
      if (item.tipo === 'nao_operacional' && !papeis.some((p) => p !== 'barbeiro')) {
        throw Erros.semPermissao('Receita não operacional é lançada pela recepção.');
      }
      await this.criarItem(tx, comanda, diaDaComanda(comanda), item);
      await this.atualizarTotais(tx, id);
    });
    return this.buscar(id);
  }

  async alterarItem(
    id: string,
    itemId: string,
    d: z.infer<typeof alterarItemSchema>,
  ): Promise<ComandaDetalhe> {
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('editar_itens', comanda, papeis, propria);
      const item = comanda.itens.find((i) => i.id === itemId);
      if (!item) throw Erros.naoEncontrado('Item não encontrado.');
      if (d.servicoId && item.tipo !== 'servico')
        throw Erros.requisicaoInvalida(
          'item_invalido',
          'Só dá para trocar o serviço de um item de serviço.',
        );
      if (d.desconto !== undefined && !papeis.some((p) => p !== 'barbeiro'))
        throw Erros.semPermissao('Desconto é dado pela recepção.');
      // Trocar o serviço, ou mudar a quantidade de um item do clube: lança de novo, e o plano
      // decide outra vez o que cobre (o limite do mês não estoura).
      const mudouQtdClube =
        item.cobertoClube && d.quantidade !== undefined && d.quantidade !== item.quantidade;
      if ((d.servicoId && d.servicoId !== item.servicoId) || mudouQtdClube) {
        await tx.itemComanda.delete({ where: { id: itemId } });
        await this.criarItem(tx, comanda, diaDaComanda(comanda), {
          tipo: 'servico',
          servicoId: d.servicoId ?? item.servicoId!,
          quantidade: d.quantidade ?? item.quantidade,
        });
      } else {
        const quantidade = d.quantidade ?? item.quantidade;
        const desconto = d.desconto ?? item.desconto;
        if (desconto > quantidade * item.precoUnitario)
          throw Erros.requisicaoInvalida(
            'desconto_invalido',
            'O desconto é maior que o valor do item.',
          );
        await tx.itemComanda.update({ where: { id: itemId }, data: { quantidade, desconto } });
      }
      await this.atualizarTotais(tx, id);
    });
    return this.buscar(id);
  }

  async removerItem(id: string, itemId: string): Promise<ComandaDetalhe> {
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('editar_itens', comanda, papeis, propria);
      const r = await tx.itemComanda.deleteMany({ where: { id: itemId, comandaId: id } });
      if (r.count === 0) throw Erros.naoEncontrado('Item não encontrado.');
      await this.atualizarTotais(tx, id);
    });
    return this.buscar(id);
  }

  async iniciar(id: string): Promise<ComandaDetalhe> {
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('iniciar', comanda, papeis, propria);
      await tx.comanda.update({
        where: { id },
        data: { status: 'em_atendimento', iniciadaEm: comanda.iniciadaEm ?? new Date() },
      });
    });
    return this.buscar(id);
  }

  async confirmar(id: string): Promise<ComandaDetalhe> {
    const contaId = Contexto.usuario().contaId;
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('confirmar', comanda, papeis, propria);
      if (!comanda.itens.some((i) => i.tipo === 'servico'))
        throw Erros.requisicaoInvalida(
          'sem_servico',
          'Lance pelo menos um serviço antes de confirmar.',
        );
      await tx.comanda.update({
        where: { id },
        data: {
          status: 'confirmada',
          confirmadaEm: new Date(),
          confirmadaPorId: Contexto.usuario().id,
          iniciadaEm: comanda.iniciadaEm ?? new Date(),
        },
      });
    });
    await this.eventos
      .publicar('comanda.confirmada', contaId, { comandaId: id })
      .catch(() => undefined);
    return this.buscar(id);
  }

  async fechar(id: string, d: FecharComandaEntrada): Promise<ComandaDetalhe> {
    const quem = Contexto.usuario();
    const pesquisa = await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      const antes = this.exigir('fechar', comanda, papeis, propria);
      if (comanda.itens.length === 0)
        throw Erros.requisicaoInvalida(
          'sem_itens',
          'Sem itens. Lance um serviço ou cancele/marque falta.',
        );
      // Comissão e preço seguem o dia do atendimento; o dinheiro entra no caixa de hoje.
      const dia = diaDaComanda(comanda);
      const agora = new Date();
      const hoje = dataLocal(agora);
      // Atendimento de outro dia, ou de hoje que nem começou: ainda não tem o que receber.
      // (Cliente adiantado que o barbeiro já começou a atender recebe normalmente.)
      const inicioMarcado = comanda.agendamento?.inicio;
      if (
        inicioMarcado &&
        (dataLocal(inicioMarcado) > hoje ||
          (inicioMarcado > agora && comanda.status === 'prevista'))
      )
        throw new ErroApp(
          HttpStatus.CONFLICT,
          'atendimento_futuro',
          `O atendimento é em ${formatarDataHora(inicioMarcado)}: receba depois que ele começar.`,
        );
      const caixa = await tx.caixaDia.findUnique({
        where: { unidadeId_data: { unidadeId: comanda.unidadeId, data: data(hoje) } },
      });
      // O caixa nunca abre sozinho: quem recebe abre (com o troco) e tenta de novo.
      if (!caixa)
        throw new ErroApp(
          HttpStatus.CONFLICT,
          'caixa_nao_aberto',
          'O caixa de hoje não foi aberto. Abra o caixa com o troco da gaveta para receber.',
        );
      if (caixa.fechadoEm)
        throw Erros.conflito(
          'O caixa de hoje já foi fechado. Peça ao gestor para reabrir o caixa.',
        );

      let itens;
      try {
        itens = ratearDesconto(comanda.itens, d.desconto);
      } catch {
        throw Erros.requisicaoInvalida(
          'desconto_invalido',
          'O desconto é maior que o total da comanda.',
        );
      }
      const totais = totaisComanda(itens);
      const falta = faltaReceber(totais.totalLiquido, d.pagamentos);
      if (falta !== 0) {
        throw Erros.validacao([
          {
            campo: 'pagamentos',
            mensagem:
              falta > 0
                ? `Faltam ${formatarMoeda(falta)} para fechar o total de ${formatarMoeda(totais.totalLiquido)}.`
                : `Os pagamentos passam ${formatarMoeda(-falta)} do total.`,
          },
        ]);
      }

      // Comissão de cada item pela regra vigente na data do atendimento.
      for (const item of itens) {
        let comissao = {
          comissaoPercentualBp: null as number | null,
          comissaoValorFixo: null as number | null,
          comissaoValor: 0,
        };
        if (item.cobertoClube && item.adesaoId && item.servicoId && item.profissionalId) {
          // Clube: sobre o preço de tabela da unidade na data, ou a comissão fixa do plano.
          const regra = await regraComissaoVigente(tx, item.profissionalId, 'servico', dia);
          const fixo = await comissaoFixaDoClube(tx, item.adesaoId, item.servicoId);
          comissao = {
            comissaoPercentualBp: fixo === null ? (regra?.percentualBp ?? null) : null,
            comissaoValorFixo: fixo ?? regra?.valorFixo ?? null,
            comissaoValor: comissaoDoClube({
              precoTabela:
                (await precoServicoVigente(tx, item.servicoId, comanda.unidadeId, dia)) ?? 0,
              quantidade: item.quantidade,
              regraProfissional: regra
                ? regra.percentualBp !== null
                  ? { percentualBp: regra.percentualBp }
                  : { valorFixo: regra.valorFixo! }
                : null,
              valorFixoClube: fixo,
            }),
          };
        } else if (item.tipo !== 'nao_operacional' && item.profissionalId) {
          const regra = await regraComissaoVigente(tx, item.profissionalId, item.tipo, dia);
          if (regra) {
            const valor = valorItem(item);
            comissao = {
              comissaoPercentualBp: regra.percentualBp,
              comissaoValorFixo: regra.valorFixo,
              comissaoValor: comissaoItem(
                valor,
                item.quantidade,
                regra.percentualBp !== null
                  ? { percentualBp: regra.percentualBp }
                  : { valorFixo: regra.valorFixo! },
              ),
            };
          }
        }
        await tx.itemComanda.update({
          where: { id: item.id },
          data: { desconto: item.desconto, ...comissao },
        });
      }
      await tx.pagamento.deleteMany({ where: { comandaId: id } });
      await tx.pagamento.createMany({
        data: d.pagamentos.map((p) => ({
          comandaId: id,
          forma: p.forma,
          valor: p.valor,
          recebidoPorId: quem.id,
        })),
      });
      await tx.comanda.update({
        where: { id },
        data: {
          ...totais,
          status: 'fechada',
          fechadaEm: new Date(),
          fechadaPorId: quem.id,
          confirmadaEm: comanda.confirmadaEm ?? new Date(),
        },
      });
      if (comanda.agendamentoId)
        await tx.agendamento.update({
          where: { id: comanda.agendamentoId },
          data: { status: 'atendido' },
        });
      await auditar(tx, {
        entidade: 'comanda',
        entidadeId: id,
        acao: 'fechar',
        antes: { status: antes },
        depois: { status: 'fechada', ...totais, pagamentos: d.pagamentos },
      });
      // Pesquisa de 1 a 5 pelo WhatsApp, uma hora depois (só para quem cabe).
      return agendarPesquisa(tx, id);
    });
    await this.eventos
      .publicar('comanda.fechada', quem.contaId, { comandaId: id })
      .catch(() => undefined);
    if (pesquisa)
      await this.filas.whatsappEntrada
        .add(
          'pesquisa',
          { tipo: 'pesquisa', contaId: quem.contaId, avaliacaoId: pesquisa.avaliacaoId },
          {
            jobId: `pesquisa_${pesquisa.avaliacaoId}`,
            delay: Math.max(0, pesquisa.enviarEm.getTime() - Date.now()),
          },
        )
        // Sem a fila, a pesquisa fica agendada no banco e não sai: não impede o fechamento.
        .catch(() => undefined);
    return this.buscar(id);
  }

  async cancelar(
    id: string,
    motivo: string,
    falta: boolean,
    avisarCliente = false,
  ): Promise<ComandaDetalhe> {
    let liberado: { unidadeId: string; profissionalId: string; inicio: Date; fim: Date } | null =
      null;
    const agendamentoId = await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      const antes = this.exigir('cancelar', comanda, papeis, propria);
      const ag = comanda.agendamentoId
        ? await tx.agendamento.findUnique({ where: { id: comanda.agendamentoId } })
        : null;
      if (ag && ['agendado', 'confirmado'].includes(ag.status)) liberado = ag;
      await tx.comanda.update({
        where: { id },
        data: { status: 'cancelada', canceladaEm: new Date(), motivoCancelamento: motivo },
      });
      if (comanda.agendamentoId)
        await tx.agendamento.update({
          where: { id: comanda.agendamentoId },
          data: { status: falta ? 'falta' : 'cancelado' },
        });
      await auditar(tx, {
        entidade: 'comanda',
        entidadeId: id,
        acao: falta ? 'falta' : 'cancelar',
        antes: { status: antes },
        depois: { status: 'cancelada' },
        motivo,
      });
      return comanda.agendamentoId;
    });
    // O horário vagou: oferecer para a lista de espera.
    if (liberado) await liberarVaga(this.filas, Contexto.usuario().contaId, liberado);
    // Cancelado (não falta): o profissional fica sabendo pelo assistente, se ligou.
    if (agendamentoId && falta)
      await avisarFalta(this.banco, this.filas, Contexto.usuario().contaId, agendamentoId);
    // Cancelado pela barbearia com "Avisar o cliente": o worker confere aceite e conexão.
    if (agendamentoId && !falta && avisarCliente && liberado)
      await this.filas.whatsappEntrada
        .add(
          'horario_cancelado',
          { tipo: 'horario_cancelado', contaId: Contexto.usuario().contaId, agendamentoId },
          { jobId: `horario_cancelado_${agendamentoId}` },
        )
        .catch(() => undefined);
    if (agendamentoId && !falta)
      await avisarEquipe(
        this.banco,
        this.filas,
        Contexto.usuario().contaId,
        agendamentoId,
        'cancelado',
      );
    return this.buscar(id);
  }

  /** Reabrir: sai do faturamento e da comissão até fechar de novo. Exige motivo e fica auditado. */
  async reabrir(id: string, motivo: string): Promise<ComandaDetalhe> {
    const contaId = Contexto.usuario().contaId;
    await this.banco.daConta(async (tx) => {
      const { comanda, propria, papeis } = await this.carregar(tx, id);
      this.exigir('reabrir', comanda, papeis, propria);
      // O dinheiro saiu do caixa do dia em que foi recebido: é esse caixa que não pode estar fechado.
      const diaDoRecebimento = dataLocal(comanda.fechadaEm ?? new Date());
      const caixa = await tx.caixaDia.findUnique({
        where: { unidadeId_data: { unidadeId: comanda.unidadeId, data: data(diaDoRecebimento) } },
      });
      if (caixa?.fechadoEm)
        throw Erros.conflito(
          'O caixa do dia em que a comanda foi recebida já foi fechado. Reabra esse caixa antes de reabrir a comanda.',
        );
      await tx.pagamento.deleteMany({ where: { comandaId: id } });
      await tx.itemComanda.updateMany({ where: { comandaId: id }, data: { comissaoValor: 0 } });
      await tx.comanda.update({
        where: { id },
        data: { status: 'reaberta', fechadaEm: null, fechadaPorId: null },
      });
      await auditar(tx, {
        entidade: 'comanda',
        entidadeId: id,
        acao: 'reabrir',
        antes: {
          status: 'fechada',
          totalLiquido: comanda.totalLiquido,
          pagamentos: comanda.pagamentos,
        },
        depois: { status: 'reaberta' },
        motivo,
      });
    });
    await this.eventos
      .publicar('comanda.reaberta', contaId, { comandaId: id, motivo })
      .catch(() => undefined);
    return this.buscar(id);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { regraComissaoVigente, type Transacao } from '@pente-fino/db';
import {
  comissaoItem,
  dataLocal,
  formatarMoeda,
  valorItem,
  type ExtratoComissao,
  type PagamentoComissaoEntrada,
  type ResumoComissao,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade, GESTAO } from '../comum/escopo.js';
import { escopoUnidades, somarDias } from '../resultados/resultados.service.js';

const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`);

@Injectable()
export class ComissoesService {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  /** Resumo de um profissional no período: previsto, fechado, pago e a receber. */
  private async resumo(
    tx: Transacao,
    profissional: { id: string; unidadeId: string; usuario: { nome: string } },
    de: string,
    ate: string,
  ): Promise<ResumoComissao> {
    const periodo = { gte: inicioDoDia(de), lt: inicioDoDia(somarDias(ate, 1)) };
    const [fechadas, abertas, pagamentos] = await Promise.all([
      tx.itemComanda.aggregate({
        _sum: { comissaoValor: true },
        where: {
          profissionalId: profissional.id,
          comanda: { status: 'fechada', fechadaEm: periodo },
        },
      }),
      tx.itemComanda.findMany({
        where: {
          profissionalId: profissional.id,
          tipo: { not: 'nao_operacional' },
          comanda: {
            status: { in: ['prevista', 'em_atendimento', 'confirmada', 'pendente', 'reaberta'] },
            OR: [{ agendamento: { inicio: periodo } }, { agendamentoId: null, criadoEm: periodo }],
          },
        },
      }),
      tx.pagamentoComissao.aggregate({
        _sum: { valor: true },
        where: {
          profissionalId: profissional.id,
          periodoInicio: { gte: data(de) },
          periodoFim: { lte: data(ate) },
        },
      }),
    ]);
    // Previsto: comandas ainda abertas, pela regra vigente hoje.
    const hoje = dataLocal(new Date());
    const regras = {
      servico: await regraComissaoVigente(tx, profissional.id, 'servico', hoje),
      produto: await regraComissaoVigente(tx, profissional.id, 'produto', hoje),
    };
    let previsto = 0;
    for (const i of abertas) {
      const regra = regras[i.tipo as 'servico' | 'produto'];
      if (!regra) continue;
      previsto += comissaoItem(
        valorItem(i),
        i.quantidade,
        regra.percentualBp !== null
          ? { percentualBp: regra.percentualBp }
          : { valorFixo: regra.valorFixo! },
      );
    }
    const fechado = fechadas._sum.comissaoValor ?? 0;
    const pago = pagamentos._sum.valor ?? 0;
    return {
      profissionalId: profissional.id,
      nome: profissional.usuario.nome,
      unidadeId: profissional.unidadeId,
      previsto,
      fechado,
      pago,
      aReceber: Math.max(0, fechado - pago),
    };
  }

  async resumoGeral(
    unidadeId: string | undefined,
    de: string,
    ate: string,
  ): Promise<ResumoComissao[]> {
    const { filtro } = escopoUnidades(unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      const profs = await tx.profissional.findMany({
        where: filtro,
        include: { usuario: true },
        orderBy: { usuario: { nome: 'asc' } },
      });
      const r = await Promise.all(profs.map((p) => this.resumo(tx, p, de, ate)));
      return r.filter((x, i) => profs[i]!.ativo || x.fechado > 0 || x.aReceber > 0);
    });
  }

  /** Extrato item por item. Barbeiro só o próprio. */
  async extrato(profissionalId: string, de: string, ate: string): Promise<ExtratoComissao> {
    return this.banco.daConta(async (tx) => {
      const p = await tx.profissional.findUnique({
        where: { id: profissionalId },
        include: { usuario: true },
      });
      if (!p) throw Erros.naoEncontrado('Profissional não encontrado.');
      if (p.usuarioId !== Contexto.usuario().id) exigirUnidade(p.unidadeId, GESTAO);
      const itens = await tx.itemComanda.findMany({
        where: {
          profissionalId,
          comanda: {
            status: 'fechada',
            fechadaEm: { gte: inicioDoDia(de), lt: inicioDoDia(somarDias(ate, 1)) },
          },
        },
        include: { comanda: { include: { cliente: true } }, servico: true, produto: true },
        orderBy: { comanda: { fechadaEm: 'desc' } },
        take: 500,
      });
      const pagamentos = await tx.pagamentoComissao.findMany({
        where: { profissionalId, periodoFim: { gte: data(de) }, periodoInicio: { lte: data(ate) } },
        orderBy: { pagoEm: 'desc' },
      });
      return {
        resumo: await this.resumo(tx, p, de, ate),
        itens: itens.map((i) => ({
          comandaId: i.comandaId,
          fechadaEm: i.comanda.fechadaEm!.toISOString(),
          cliente: i.comanda.cliente?.nome ?? null,
          descricao: i.servico?.nome ?? i.produto?.nome ?? i.descricao ?? 'Item',
          valor: valorItem(i),
          comissao: i.comissaoValor,
        })),
        pagamentos: pagamentos.map((x) => ({
          id: x.id,
          periodoInicio: dataTexto(x.periodoInicio),
          periodoFim: dataTexto(x.periodoFim),
          valor: x.valor,
          pagoEm: x.pagoEm.toISOString(),
        })),
      };
    });
  }

  async registrarPagamento(d: PagamentoComissaoEntrada) {
    return this.banco.daConta(async (tx) => {
      const p = await tx.profissional.findUnique({
        where: { id: d.profissionalId },
        include: { usuario: true },
      });
      if (!p) throw Erros.naoEncontrado('Profissional não encontrado.');
      exigirUnidade(p.unidadeId, GESTAO);
      const r = await this.resumo(tx, p, d.periodoInicio, d.periodoFim);
      if (d.valor > r.aReceber) {
        throw Erros.validacao([
          {
            campo: 'valor',
            mensagem: `O valor passa do que falta pagar no período (${formatarMoeda(r.aReceber)}).`,
          },
        ]);
      }
      const pg = await tx.pagamentoComissao.create({
        data: {
          profissionalId: d.profissionalId,
          periodoInicio: data(d.periodoInicio),
          periodoFim: data(d.periodoFim),
          valor: d.valor,
          pagoPorId: Contexto.usuario().id,
        },
      });
      await auditar(tx, {
        entidade: 'pagamento_comissao',
        entidadeId: pg.id,
        acao: 'pagar',
        depois: d,
      });
      return this.resumo(tx, p, d.periodoInicio, d.periodoFim);
    });
  }
}

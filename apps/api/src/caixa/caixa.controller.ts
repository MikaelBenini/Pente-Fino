import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { gravarAviso, type Transacao } from '@pente-fino/db';
import {
  abrirCaixaSchema,
  avisoCaixaDivergente,
  avisoCaixaFechado,
  dataLocal,
  fecharCaixaSchema,
  statusEfetivo,
  type CaixaDia,
  type FormaPagamento,
  type StatusComanda,
  type TrabalhoNotificacao,
  entradasDoCaixa,
  restanteAposSinal,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { emSequencia } from '../comum/sequencia.js';
import { Filas } from '../filas/filas.module.js';

const consultaSchema = z.object({
  unidadeId: z.uuid({ error: 'Unidade inválida.' }),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
const reabrirSchema = z.object({
  unidadeId: z.uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  motivo: z.string().trim().min(5, { error: 'Explique o motivo.' }).max(300),
});
const FORMAS: FormaPagamento[] = ['dinheiro', 'pix', 'debito', 'credito', 'clube'];

@ApiTags('Caixa')
@ApiBearerAuth()
@Controller('caixa')
export class CaixaController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(Filas) private readonly filas: Filas,
  ) {}

  private async montar(tx: Transacao, unidadeId: string, dia: string): Promise<CaixaDia> {
    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(inicio.getTime() + 86_400_000);
    // Dinheiro do dia = o que foi recebido no dia (fechadaEm), não o que estava agendado para ele.
    const recebidasNoDia = {
      unidadeId,
      status: 'fechada' as const,
      fechadaEm: { gte: inicio, lt: fim },
    };
    // A receber = atendimentos do dia ainda em aberto.
    const doDia = {
      unidadeId,
      OR: [
        { agendamento: { inicio: { gte: inicio, lt: fim } } },
        { agendamentoId: null, criadoEm: { gte: inicio, lt: fim } },
      ],
    };
    if (!(await tx.unidade.findUnique({ where: { id: unidadeId } })))
      throw Erros.naoEncontrado('Unidade não encontrada.');
    const [caixa, comandas, fechadas, sinaisRecebidos, sinaisDevolvidos] = await emSequencia([
      tx.caixaDia.findUnique({ where: { unidadeId_data: { unidadeId, data: data(dia) } } }),
      tx.comanda.findMany({ where: doDia, include: { pagamentos: true, agendamento: true } }),
      tx.comanda.findMany({ where: recebidasNoDia, include: { pagamentos: true } }),
      // Sinal (receber adiantado): entra no dia em que foi recebido e sai no dia da devolução.
      tx.pagamento.findMany({
        where: { sinal: true, criadoEm: { gte: inicio, lt: fim }, comanda: { unidadeId } },
      }),
      tx.pagamento.findMany({
        where: { sinal: true, devolvidoEm: { gte: inicio, lt: fim }, comanda: { unidadeId } },
      }),
    ]);
    const entradas = entradasDoCaixa({
      // Os sinais já entraram no dia em que foram recebidos.
      fechadas: fechadas.flatMap((c) => c.pagamentos.filter((p) => !p.sinal)),
      sinaisRecebidos,
      sinaisDevolvidos,
    });
    const porForma = entradas.porForma.filter((f) => FORMAS.includes(f.forma));
    const agora = new Date();
    const abertas = comandas.filter((c) => {
      const s = statusEfetivo(c.status as StatusComanda, c.agendamento?.fim ?? null, agora);
      return ['confirmada', 'pendente', 'reaberta', 'em_atendimento'].includes(s);
    });
    const valorAbertura = caixa?.valorAbertura ?? 0;
    const dinheiroEsperado =
      valorAbertura + (porForma.find((f) => f.forma === 'dinheiro')?.total ?? 0);
    return {
      unidadeId,
      data: dia,
      situacao: !caixa ? 'nao_aberto' : caixa.fechadoEm ? 'fechado' : 'aberto',
      valorAbertura,
      porForma,
      totalRecebido: entradas.total,
      dinheiroEsperado: caixa?.fechadoEm
        ? (caixa.totalSistema ?? dinheiroEsperado)
        : dinheiroEsperado,
      totalInformado: caixa?.totalInformado ?? null,
      divergencia: caixa?.divergencia ?? null,
      aReceber: {
        quantidade: abertas.length,
        // Menos o sinal que já entrou (e não foi devolvido).
        total: abertas.reduce(
          (s, c) =>
            s +
            Math.max(
              0,
              restanteAposSinal(
                c.totalLiquido,
                c.pagamentos.filter((p) => p.sinal && !p.devolvidoEm),
              ),
            ),
          0,
        ),
      },
      fechadas: fechadas.length,
      sinais: entradas.sinais,
    };
  }

  @Get()
  @Papeis('dono', 'gestor', 'recepcao')
  @ApiOperation({ summary: 'Caixa do dia: entradas por forma, a receber e divergência' })
  ver(@Consulta(consultaSchema) c: z.infer<typeof consultaSchema>): Promise<CaixaDia> {
    return this.banco.daConta((tx) =>
      this.montar(tx, c.unidadeId, c.data ?? dataLocal(new Date())),
    );
  }

  @Post('abrir')
  @Papeis('dono', 'gestor', 'recepcao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abrir o caixa com o troco da gaveta' })
  abrir(@Corpo(abrirCaixaSchema) d: z.infer<typeof abrirCaixaSchema>): Promise<CaixaDia> {
    return this.banco.daConta(async (tx) => {
      // Confere a unidade antes de gravar: a chave estrangeira não passa pelo RLS.
      if (!(await tx.unidade.findUnique({ where: { id: d.unidadeId } })))
        throw Erros.naoEncontrado('Unidade não encontrada.');
      const existente = await tx.caixaDia.findUnique({
        where: { unidadeId_data: { unidadeId: d.unidadeId, data: data(d.data) } },
      });
      if (existente?.fechadoEm) throw Erros.conflito('O caixa deste dia já foi fechado.');
      if (existente)
        await tx.caixaDia.update({
          where: { id: existente.id },
          data: { valorAbertura: d.valorAbertura },
        });
      else
        await tx.caixaDia.create({
          data: {
            unidadeId: d.unidadeId,
            data: data(d.data),
            valorAbertura: d.valorAbertura,
            abertoPorId: Contexto.usuario().id,
          },
        });
      return this.montar(tx, d.unidadeId, d.data);
    });
  }

  @Post('fechar')
  @Papeis('dono', 'gestor', 'recepcao')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fechar o caixa com a contagem da gaveta (registra a divergência)' })
  async fechar(@Corpo(fecharCaixaSchema) d: z.infer<typeof fecharCaixaSchema>): Promise<CaixaDia> {
    let push: TrabalhoNotificacao[] = [];
    const resposta = await this.banco.daConta(async (tx) => {
      const atual = await this.montar(tx, d.unidadeId, d.data);
      if (atual.situacao === 'fechado') throw Erros.conflito('Este caixa já está fechado.');
      const divergencia = d.totalInformado - atual.dinheiroEsperado;
      const dados = {
        fechadoPorId: Contexto.usuario().id,
        fechadoEm: new Date(),
        totalSistema: atual.dinheiroEsperado,
        totalInformado: d.totalInformado,
        divergencia,
      };
      const caixa = await tx.caixaDia.upsert({
        where: { unidadeId_data: { unidadeId: d.unidadeId, data: data(d.data) } },
        create: {
          unidadeId: d.unidadeId,
          data: data(d.data),
          abertoPorId: Contexto.usuario().id,
          ...dados,
        },
        update: dados,
      });
      await auditar(tx, {
        entidade: 'caixa_dia',
        entidadeId: caixa.id,
        acao: 'fechar',
        depois: { esperado: atual.dinheiroEsperado, informado: d.totalInformado, divergencia },
      });
      // Resumo do fechamento para dono e gestor (central de avisos e celular). Com diferença na
      // gaveta, sai o aviso de diferença, com os mesmos totais (um aviso só por fechamento).
      const unidade = await tx.unidade.findUniqueOrThrow({ where: { id: d.unidadeId } });
      const fechadoPor =
        (await tx.usuario.findUnique({ where: { id: Contexto.usuario().id } }))?.nome ?? null;
      const totais = {
        totalRecebido: atual.totalRecebido,
        fechadas: atual.fechadas,
        porForma: atual.porForma,
      };
      const aviso =
        avisoCaixaDivergente({
          caixaId: caixa.id,
          unidade: unidade.nome,
          dia: d.data,
          totalSistema: atual.dinheiroEsperado,
          totalInformado: d.totalInformado,
          fechadoPor,
          totais,
        }) ??
        avisoCaixaFechado({
          caixaId: caixa.id,
          unidade: unidade.nome,
          dia: d.data,
          fechadoPor,
          totais,
        });
      push = await gravarAviso(tx, Contexto.usuario().contaId, d.unidadeId, aviso);
      return this.montar(tx, d.unidadeId, d.data);
    });
    for (const n of push) await this.filas.notificacoes.add('push', n).catch(() => undefined);
    return resposta;
  }

  @Post('reabrir')
  @Papeis('dono', 'gestor')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reabrir um caixa fechado (motivo obrigatório)' })
  reabrir(@Corpo(reabrirSchema) d: z.infer<typeof reabrirSchema>): Promise<CaixaDia> {
    return this.banco.daConta(async (tx) => {
      const caixa = await tx.caixaDia.findUnique({
        where: { unidadeId_data: { unidadeId: d.unidadeId, data: data(d.data) } },
      });
      if (!caixa?.fechadoEm) throw Erros.conflito('Este caixa não está fechado.');
      await tx.caixaDia.update({
        where: { id: caixa.id },
        data: {
          fechadoEm: null,
          fechadoPorId: null,
          totalInformado: null,
          divergencia: null,
          totalSistema: null,
        },
      });
      await auditar(tx, {
        entidade: 'caixa_dia',
        entidadeId: caixa.id,
        acao: 'reabrir',
        antes: { divergencia: caixa.divergencia },
        motivo: d.motivo,
      });
      return this.montar(tx, d.unidadeId, d.data);
    });
  }
}

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { adesaoDoCliente, detalharAdesao, INCLUIR_ADESAO, type Transacao } from '@pente-fino/db';
import {
  adesaoClubeSchema,
  baixaMensalidadeSchema,
  pixCopiaECola,
  recebimentoPixSchema,
  vencimentoDepoisDaBaixa,
  type BaixaMensalidadeEntrada,
  type MensalidadePix,
  type RecebimentoPix,
  cancelarAdesaoSchema,
  dataLocal,
  itemClubeSchema,
  somarMeses,
  type AdesaoClubeEntrada,
  type AdesaoDetalhe,
  type DataISO,
  type ItemClubeDetalhe,
  type ItemClubeEntrada,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, exigirUnidade, filtroUnidade } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';

/** Quem vê o clube e cuida das adesões no balcão. */
const BALCAO = ['dono', 'gestor', 'recepcao'] as const;
const consultaAdesoes = z.object({
  situacao: z.enum(['ativa', 'vencida', 'cancelada']).optional(),
});

/**
 * Clube da barbearia: planos por unidade (o dono cadastra) e adesões dos clientes (dono, gestor
 * e recepção). Os usos do ciclo saem das comandas.
 */
@ApiTags('Clube')
@ApiBearerAuth()
@Controller('clube')
export class ClubeController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  private async plano(tx: Transacao, id: string) {
    const p = await tx.itemClube.findUnique({ where: { id } });
    if (!p) throw Erros.naoEncontrado('Plano não encontrado.');
    return p;
  }

  @Get('itens')
  @Papeis(...BALCAO)
  @ApiOperation({ summary: 'Planos do clube (assinatura, combo, convênio) por unidade' })
  itens(): Promise<ItemClubeDetalhe[]> {
    return this.banco.daConta(async (tx) => {
      const itens = await tx.itemClube.findMany({
        where: filtroUnidade([...BALCAO]),
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
        include: {
          unidade: { select: { nome: true } },
          servicos: { include: { servico: { select: { nome: true } } } },
          _count: { select: { adesoes: { where: { status: 'ativa' } } } },
        },
      });
      return itens.map((i) => ({
        id: i.id,
        unidadeId: i.unidadeId,
        unidade: i.unidade.nome,
        tipo: i.tipo,
        nome: i.nome,
        descricao: i.descricao,
        valor: i.valor,
        limiteUsoMes: i.limiteUsoMes,
        ativo: i.ativo,
        servicos: i.servicos.map((s) => ({
          servicoId: s.servicoId,
          nome: s.servico.nome,
          quantidade: s.quantidade,
          comissaoValorFixo: s.comissaoValorFixo,
        })),
        assinantes: i._count.adesoes,
      }));
    });
  }

  @Post('itens')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Novo plano do clube' })
  async criar(@Corpo(itemClubeSchema) d: ItemClubeEntrada): Promise<{ id: string }> {
    exigirUnidade(d.unidadeId, ['dono']);
    return this.banco.daConta(async (tx) => {
      const { servicos, ...dados } = d;
      const p = await tx.itemClube.create({
        data: { ...dados, servicos: { create: servicos.map((s) => ({ ...s })) } },
      });
      await auditar(tx, { entidade: 'item_clube', entidadeId: p.id, acao: 'criar', depois: d });
      return { id: p.id };
    });
  }

  @Put('itens/:id')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Alterar o plano (vale para os próximos atendimentos)' })
  async alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(itemClubeSchema) d: ItemClubeEntrada,
  ): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const antes = await this.plano(tx, id);
      exigirUnidade(antes.unidadeId, ['dono']);
      if (d.unidadeId !== antes.unidadeId)
        throw Erros.requisicaoInvalida('unidade', 'O plano não muda de unidade. Crie outro.');
      const { servicos, ...dados } = d;
      await tx.itemClubeServico.deleteMany({ where: { itemClubeId: id } });
      await tx.itemClube.update({
        where: { id },
        data: { ...dados, servicos: { create: servicos.map((s) => ({ ...s })) } },
      });
      await auditar(tx, {
        entidade: 'item_clube',
        entidadeId: id,
        acao: 'alterar',
        antes,
        depois: d,
      });
    });
  }

  @Get('adesoes')
  @Papeis(...BALCAO)
  @ApiOperation({ summary: 'Assinantes do clube, com usos e o que resta no ciclo' })
  adesoes(@Consulta(consultaAdesoes) q: z.infer<typeof consultaAdesoes>): Promise<AdesaoDetalhe[]> {
    const hoje = dataLocal(new Date()) as DataISO;
    const situacao =
      q.situacao === 'cancelada'
        ? { status: 'cancelada' as const }
        : q.situacao === 'vencida'
          ? { status: 'ativa' as const, vencimento: { lte: data(hoje) } }
          : q.situacao === 'ativa'
            ? { status: 'ativa' as const, vencimento: { gt: data(hoje) } }
            : { status: 'ativa' as const };
    return this.banco.daConta(async (tx) => {
      const lista = await tx.adesaoClube.findMany({
        where: { itemClube: filtroUnidade([...BALCAO]), ...situacao },
        orderBy: { vencimento: 'asc' },
        include: INCLUIR_ADESAO,
        take: 300,
      });
      const r: AdesaoDetalhe[] = [];
      for (const a of lista) r.push(await detalharAdesao(tx, a, hoje));
      return r;
    });
  }

  @Get('cliente/:clienteId')
  @Papeis('dono', 'gestor', 'recepcao', 'barbeiro')
  @ApiOperation({ summary: 'O plano do cliente (ficha e comanda); null se não é assinante' })
  doCliente(
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
  ): Promise<{ adesao: AdesaoDetalhe | null }> {
    return this.banco.daConta(async (tx) => {
      const a = await adesaoDoCliente(tx, clienteId);
      return { adesao: a ? await detalharAdesao(tx, a, dataLocal(new Date()) as DataISO) : null };
    });
  }

  @Post('adesoes')
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Colocar o cliente no plano (um plano ativo por cliente)' })
  async aderir(@Corpo(adesaoClubeSchema) d: AdesaoClubeEntrada): Promise<{ id: string }> {
    return this.banco.daConta(async (tx) => {
      const p = await this.plano(tx, d.itemClubeId);
      exigirUnidade(p.unidadeId, [...BALCAO]);
      if (!p.ativo) throw Erros.conflito('Este plano está desativado.');
      if (!(await tx.cliente.findUnique({ where: { id: d.clienteId } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      if (await adesaoDoCliente(tx, d.clienteId))
        throw Erros.conflito('Este cliente já está num plano. Cancele o atual antes de trocar.');
      const vencimento = d.vencimento ?? somarMeses(d.inicio as DataISO, 1);
      if (vencimento <= d.inicio)
        throw Erros.requisicaoInvalida('vencimento', 'O vencimento precisa ser depois do início.');
      const a = await tx.adesaoClube.create({
        data: {
          clienteId: d.clienteId,
          itemClubeId: d.itemClubeId,
          inicio: data(d.inicio),
          vencimento: data(vencimento),
          criadoPorId: Contexto.usuario().id,
        },
      });
      await auditar(tx, {
        entidade: 'adesao_clube',
        entidadeId: a.id,
        acao: 'aderir',
        depois: { ...d, vencimento },
      });
      return { id: a.id };
    });
  }

  @Get('pix')
  @Papeis('dono', 'gestor')
  @ApiOperation({ summary: 'Pix da barbearia para as mensalidades (null = não cadastrado)' })
  verPix(): Promise<{ pix: RecebimentoPix | null }> {
    return this.banco.daConta(async (tx) => {
      const c = await tx.conta.findFirstOrThrow({ select: { pix: true } });
      const r = recebimentoPixSchema.safeParse(c.pix);
      return { pix: r.success ? r.data : null };
    });
  }

  @Put('pix')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cadastrar a chave Pix que recebe as mensalidades' })
  async salvarPix(@Corpo(recebimentoPixSchema) d: RecebimentoPix): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const c = await tx.conta.findFirstOrThrow();
      await tx.conta.update({ where: { id: c.id }, data: { pix: d } });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: c.id,
        acao: 'pix',
        antes: { pix: c.pix },
        depois: { pix: d },
      });
    });
  }

  private async adesaoDoBalcao(tx: Transacao, id: string) {
    const a = await tx.adesaoClube.findUnique({ where: { id }, include: { itemClube: true } });
    if (!a) throw Erros.naoEncontrado('Adesão não encontrada.');
    exigirUnidade(a.itemClube.unidadeId, [...BALCAO]);
    return a;
  }

  @Get('adesoes/:id/mensalidade')
  @Papeis(...BALCAO)
  @ApiOperation({ summary: 'Valor, vencimento e o Pix copia e cola da mensalidade' })
  mensalidade(@Param('id', ParseUUIDPipe) id: string): Promise<MensalidadePix> {
    return this.banco.daConta(async (tx) => {
      const a = await this.adesaoDoBalcao(tx, id);
      const conta = await tx.conta.findFirstOrThrow({ select: { pix: true } });
      const pix = recebimentoPixSchema.safeParse(conta.pix);
      return {
        valor: a.itemClube.valor,
        vencimento: a.vencimento.toISOString().slice(0, 10) as DataISO,
        copiaECola: pix.success
          ? pixCopiaECola({
              ...pix.data,
              valor: a.itemClube.valor,
              identificador: `CLUBE${a.id.slice(0, 8)}`,
            })
          : null,
      };
    });
  }

  @Post('adesoes/:id/pagamentos')
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dar baixa na mensalidade: o vencimento anda um mês' })
  async baixa(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(baixaMensalidadeSchema) d: BaixaMensalidadeEntrada,
  ): Promise<{ vencimento: DataISO }> {
    const hoje = dataLocal(new Date()) as DataISO;
    return this.banco.daConta(async (tx) => {
      const a = await this.adesaoDoBalcao(tx, id);
      if (a.status === 'cancelada')
        throw Erros.conflito('Adesão cancelada. Coloque o cliente no plano de novo.');
      const atual = a.vencimento.toISOString().slice(0, 10) as DataISO;
      const vencimento = vencimentoDepoisDaBaixa(atual, hoje);
      const valor = d.valor ?? a.itemClube.valor;
      await tx.pagamentoClube.create({
        data: {
          adesaoId: id,
          valor,
          forma: d.forma,
          pagoEm: data(hoje),
          referenteA: data(atual),
          recebidoPorId: Contexto.usuario().id,
        },
      });
      await tx.adesaoClube.update({
        where: { id },
        data: { vencimento: data(vencimento), avisoVencimentoEm: null },
      });
      await auditar(tx, {
        entidade: 'adesao_clube',
        entidadeId: id,
        acao: 'mensalidade',
        antes: { vencimento: atual },
        depois: { vencimento, valor, forma: d.forma },
      });
      return { vencimento };
    });
  }

  @Post('adesoes/:id/cancelar')
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar a adesão, com motivo (o histórico fica)' })
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(cancelarAdesaoSchema) d: z.infer<typeof cancelarAdesaoSchema>,
  ): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const a = await tx.adesaoClube.findUnique({ where: { id }, include: { itemClube: true } });
      if (!a) throw Erros.naoEncontrado('Adesão não encontrada.');
      exigirUnidade(a.itemClube.unidadeId, [...BALCAO]);
      if (a.status === 'cancelada') throw Erros.conflito('Esta adesão já foi cancelada.');
      await tx.adesaoClube.update({
        where: { id },
        data: { status: 'cancelada', canceladaEm: new Date(), motivoCancelamento: d.motivo },
      });
      await auditar(tx, {
        entidade: 'adesao_clube',
        entidadeId: id,
        acao: 'cancelar',
        antes: { status: a.status },
        depois: { status: 'cancelada' },
        motivo: d.motivo,
      });
    });
  }
}

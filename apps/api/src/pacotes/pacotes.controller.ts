// Pacotes de sessões (Fase 1d, E2; regra aprovada pelo dono em 28/11/2026: igual ao clube). O dono
// e o gestor cadastram o pacote da unidade; o balcão vende ao cliente (o pagamento entra no
// faturamento no dia, linha "Pacotes") e cancela com motivo. As sessões saem das comandas: cada
// serviço lançado para o cliente usa o pacote que vence primeiro (partesDoServico).
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
import { usadasDoPacote, type Transacao } from '@pente-fino/db';
import {
  cancelarPacoteSchema,
  dataLocal,
  funcoesDaConta,
  pacoteSchema,
  saldoDoPacote,
  situacaoDoPacote,
  validoAteDoPacote,
  venderPacoteSchema,
  type PacoteDetalhe,
  type PacoteDoCliente,
  type PacoteEntrada,
  type VenderPacoteEntrada,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { exigirNaUnidade } from '../comum/catalogo.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, exigirUnidade, filtroUnidade } from '../comum/escopo.js';
import { Corpo } from '../comum/validacao.js';

const BALCAO = ['dono', 'gestor', 'recepcao'] as const;
const CADASTRO = ['dono', 'gestor'] as const;
const texto = (d: Date) => d.toISOString().slice(0, 10);

/** A função "Pacotes" precisa estar ligada (Configurações → Funções; padrão da estética e unhas). */
async function exigirFuncaoPacotes(tx: Transacao): Promise<void> {
  const conta = await tx.conta.findFirst({ select: { segmento: true, funcoes: true } });
  const ligadas = funcoesDaConta(
    conta?.segmento,
    Array.isArray(conta?.funcoes) ? (conta.funcoes as string[]) : null,
  );
  if (!ligadas.includes('pacotes'))
    throw Erros.requisicaoInvalida(
      'funcao_desligada',
      'Pacotes estão desligados. Ligue em Configurações → Funções.',
    );
}

@ApiTags('Pacotes')
@ApiBearerAuth()
@Controller('pacotes')
export class PacotesController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get()
  @Papeis(...BALCAO)
  @ApiOperation({ summary: 'Pacotes de sessões que a conta vende, por unidade' })
  listar(): Promise<PacoteDetalhe[]> {
    const hoje = data(dataLocal(new Date()));
    return this.banco.daConta(async (tx) => {
      const lista = await tx.pacote.findMany({
        where: filtroUnidade([...BALCAO]),
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
        include: {
          servico: { select: { nome: true } },
          _count: {
            select: { vendidos: { where: { canceladoEm: null, validoAte: { gte: hoje } } } },
          },
        },
      });
      return lista.map((p) => ({
        id: p.id,
        nome: p.nome,
        unidadeId: p.unidadeId,
        servicoId: p.servicoId,
        servico: p.servico.nome,
        sessoes: p.sessoes,
        validadeDias: p.validadeDias,
        valor: p.valor,
        ativo: p.ativo,
        ativos: p._count.vendidos,
      }));
    });
  }

  private async conferir(tx: Transacao, d: PacoteEntrada) {
    await exigirFuncaoPacotes(tx);
    exigirUnidade(d.unidadeId, [...CADASTRO]);
    const s = await tx.servico.findUnique({ where: { id: d.servicoId } });
    if (!s || !s.ativo) throw Erros.naoEncontrado('Serviço não encontrado.');
    exigirNaUnidade(s, d.unidadeId);
  }

  @Post()
  @Papeis(...CADASTRO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Novo pacote (ex.: 10 sessões de drenagem por R$ 1.000, em 180 dias)' })
  criar(@Corpo(pacoteSchema) d: PacoteEntrada): Promise<{ id: string }> {
    return this.banco.daConta(async (tx) => {
      await this.conferir(tx, d);
      const p = await tx.pacote.create({ data: d });
      await auditar(tx, { entidade: 'pacote', entidadeId: p.id, acao: 'criar', depois: d });
      return { id: p.id };
    });
  }

  @Put(':id')
  @Papeis(...CADASTRO)
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Alterar o pacote (quem já comprou fica com o que comprou)' })
  async alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(pacoteSchema) d: PacoteEntrada,
  ): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const antes = await tx.pacote.findUnique({ where: { id } });
      if (!antes) throw Erros.naoEncontrado('Pacote não encontrado.');
      exigirUnidade(antes.unidadeId, [...CADASTRO]);
      if (d.unidadeId !== antes.unidadeId)
        throw Erros.requisicaoInvalida('unidade', 'O pacote não muda de unidade. Crie outro.');
      await this.conferir(tx, d);
      await tx.pacote.update({ where: { id }, data: d });
      await auditar(tx, { entidade: 'pacote', entidadeId: id, acao: 'alterar', antes, depois: d });
    });
  }

  @Post('vender')
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Vender o pacote ao cliente: o pagamento entra no faturamento hoje' })
  vender(@Corpo(venderPacoteSchema) d: VenderPacoteEntrada): Promise<{ id: string }> {
    const hoje = dataLocal(new Date());
    return this.banco.daConta(async (tx) => {
      await exigirFuncaoPacotes(tx);
      const p = await tx.pacote.findUnique({ where: { id: d.pacoteId } });
      if (!p) throw Erros.naoEncontrado('Pacote não encontrado.');
      exigirUnidade(p.unidadeId, [...BALCAO]);
      if (!p.ativo) throw Erros.conflito('Este pacote está desativado.');
      if (!(await tx.cliente.findUnique({ where: { id: d.clienteId } })))
        throw Erros.naoEncontrado('Cliente não encontrado.');
      const validoAte = validoAteDoPacote(hoje, p.validadeDias);
      const v = await tx.pacoteCliente.create({
        data: {
          pacoteId: p.id,
          clienteId: d.clienteId,
          unidadeId: p.unidadeId,
          servicoId: p.servicoId,
          nome: p.nome,
          sessoes: p.sessoes,
          valorPago: p.valor,
          forma: d.forma,
          pagoEm: data(hoje),
          validoAte: data(validoAte),
          vendidoPorId: Contexto.usuario().id,
        },
      });
      await auditar(tx, {
        entidade: 'pacote_cliente',
        entidadeId: v.id,
        acao: 'vender',
        depois: { ...d, valor: p.valor, sessoes: p.sessoes, validoAte },
      });
      return { id: v.id };
    });
  }

  @Post('vendidos/:id/cancelar')
  @Papeis(...BALCAO)
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancelar o pacote do cliente, com motivo (o que já foi pago continua no mês)',
  })
  async cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(cancelarPacoteSchema) d: z.infer<typeof cancelarPacoteSchema>,
  ): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const v = await tx.pacoteCliente.findUnique({ where: { id } });
      if (!v) throw Erros.naoEncontrado('Pacote não encontrado.');
      exigirUnidade(v.unidadeId, [...BALCAO]);
      if (v.canceladoEm) throw Erros.conflito('Este pacote já foi cancelado.');
      await tx.pacoteCliente.update({
        where: { id },
        data: { canceladoEm: new Date(), motivoCancelamento: d.motivo },
      });
      await auditar(tx, {
        entidade: 'pacote_cliente',
        entidadeId: id,
        acao: 'cancelar',
        motivo: d.motivo,
        depois: { cancelado: true },
      });
    });
  }

  @Get('cliente/:clienteId')
  @Papeis('dono', 'gestor', 'recepcao', 'profissional')
  @ApiOperation({ summary: 'Pacotes do cliente com o saldo de sessões (ficha e comanda)' })
  doCliente(@Param('clienteId', ParseUUIDPipe) clienteId: string): Promise<PacoteDoCliente[]> {
    const hoje = dataLocal(new Date());
    return this.banco.daConta(async (tx) => {
      const lista = await tx.pacoteCliente.findMany({
        where: { clienteId },
        orderBy: { criadoEm: 'desc' },
        include: { pacote: { select: { servico: { select: { nome: true } } } } },
        take: 50,
      });
      const r: PacoteDoCliente[] = [];
      for (const v of lista) {
        const usadas = await usadasDoPacote(tx, v.id);
        const validoAte = texto(v.validoAte);
        r.push({
          id: v.id,
          pacoteId: v.pacoteId,
          nome: v.nome,
          servicoId: v.servicoId,
          servico: v.pacote.servico.nome,
          unidadeId: v.unidadeId,
          sessoes: v.sessoes,
          usadas,
          saldo: saldoDoPacote(v.sessoes, usadas),
          validoAte,
          valorPago: v.valorPago,
          vendidoEm: texto(v.pagoEm),
          situacao: situacaoDoPacote(
            {
              sessoes: v.sessoes,
              usadas,
              validoAte,
              canceladoEm: v.canceladoEm?.toISOString() ?? null,
            },
            hoje,
          ),
        });
      }
      return r;
    });
  }
}

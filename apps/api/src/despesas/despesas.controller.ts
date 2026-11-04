import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma, type Transacao } from '@pente-fino/db';
import {
  categoriaDespesaSchema,
  despesaSchema,
  podeNaUnidade,
  type DespesaDetalhe,
  type DespesaEntrada,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, GESTAO } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { escopoUnidades } from '../resultados/resultados.service.js';
import { umPorVez } from '../comum/sequencia.js';

const consulta = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, { error: 'Mês inválido.' }),
  unidadeId: z.uuid().optional(),
});

/** Despesa da conta (sem unidade) é do dono; na unidade, dono ou gestor dela. */
function exigirAlcance(unidadeId: string | null) {
  const papeis = Contexto.usuario().papeis;
  const ok =
    unidadeId === null
      ? papeis.some((p) => p.papel === 'dono' && p.unidadeId === null)
      : podeNaUnidade(papeis, unidadeId, GESTAO);
  if (!ok)
    throw Erros.semPermissao(
      unidadeId === null ? 'Despesa da rede inteira é lançada pelo dono.' : undefined,
    );
}

async function detalhe(tx: Transacao, id: string): Promise<DespesaDetalhe> {
  const d = await tx.despesa.findUniqueOrThrow({ where: { id }, include: { categoria: true } });
  return {
    id: d.id,
    unidadeId: d.unidadeId,
    categoriaId: d.categoriaId,
    categoria: d.categoria.nome,
    grupo: d.categoria.grupo,
    descricao: d.descricao,
    valor: d.valor,
    competencia: dataTexto(d.competencia).slice(0, 7),
    vencimento: d.vencimento ? dataTexto(d.vencimento) : null,
    pago: d.pago,
  };
}

@ApiTags('Despesas')
@ApiBearerAuth()
@Controller()
export class DespesasController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get('categorias-despesa')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Categorias e o grupo de cada uma' })
  categorias() {
    return this.banco.daConta((tx) =>
      tx.categoriaDespesa.findMany({
        where: { ativa: true },
        select: { id: true, nome: true, grupo: true },
        orderBy: [{ grupo: 'asc' }, { nome: 'asc' }],
      }),
    );
  }

  @Post('categorias-despesa')
  @Papeis('dono')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nova categoria' })
  novaCategoria(@Corpo(categoriaDespesaSchema) c: z.infer<typeof categoriaDespesaSchema>) {
    return this.banco
      .daConta((tx) =>
        tx.categoriaDespesa.create({ data: c, select: { id: true, nome: true, grupo: true } }),
      )
      .catch((e: unknown) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
          throw Erros.conflito('Já existe uma categoria com esse nome.');
        throw e;
      });
  }

  @Get('despesas')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Despesas da competência (gestor vê só a unidade dele)' })
  async listar(@Consulta(consulta) c: z.infer<typeof consulta>): Promise<DespesaDetalhe[]> {
    const { filtro, incluiConta } = escopoUnidades(c.unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      const lista = await tx.despesa.findMany({
        where: { competencia: data(`${c.mes}-01`), ...(incluiConta && !c.unidadeId ? {} : filtro) },
        orderBy: [{ pago: 'asc' }, { vencimento: 'asc' }, { descricao: 'asc' }],
        select: { id: true },
      });
      return umPorVez(lista, (d) => detalhe(tx, d.id));
    });
  }

  @Post('despesas')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Lançar despesa' })
  criar(@Corpo(despesaSchema) d: DespesaEntrada): Promise<DespesaDetalhe> {
    exigirAlcance(d.unidadeId);
    return this.banco.daConta(async (tx) => {
      if (d.unidadeId && !(await tx.unidade.findUnique({ where: { id: d.unidadeId } })))
        throw Erros.naoEncontrado('Unidade não encontrada.');
      if (!(await tx.categoriaDespesa.findUnique({ where: { id: d.categoriaId } })))
        throw Erros.naoEncontrado('Categoria não encontrada.');
      const nova = await tx.despesa.create({
        data: {
          unidadeId: d.unidadeId,
          categoriaId: d.categoriaId,
          descricao: d.descricao,
          valor: d.valor,
          competencia: data(`${d.competencia}-01`),
          vencimento: d.vencimento ? data(d.vencimento) : null,
          pago: d.pago,
          pagoEm: d.pago ? new Date() : null,
        },
      });
      await auditar(tx, { entidade: 'despesa', entidadeId: nova.id, acao: 'criar', depois: d });
      return detalhe(tx, nova.id);
    });
  }

  @Patch('despesas/:id')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Alterar despesa ou marcar como paga' })
  alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(despesaSchema.partial()) d: Partial<DespesaEntrada>,
  ): Promise<DespesaDetalhe> {
    return this.banco.daConta(async (tx) => {
      const antes = await tx.despesa.findUnique({ where: { id } });
      if (!antes) throw Erros.naoEncontrado('Despesa não encontrada.');
      exigirAlcance(antes.unidadeId);
      if (d.unidadeId !== undefined) exigirAlcance(d.unidadeId);
      if (
        d.categoriaId &&
        !(await tx.categoriaDespesa.findUnique({ where: { id: d.categoriaId } }))
      )
        throw Erros.naoEncontrado('Categoria não encontrada.');
      await tx.despesa.update({
        where: { id },
        data: {
          unidadeId: d.unidadeId,
          categoriaId: d.categoriaId,
          descricao: d.descricao,
          valor: d.valor,
          competencia: d.competencia ? data(`${d.competencia}-01`) : undefined,
          vencimento:
            d.vencimento === undefined ? undefined : d.vencimento ? data(d.vencimento) : null,
          pago: d.pago,
          pagoEm: d.pago === undefined ? undefined : d.pago ? (antes.pagoEm ?? new Date()) : null,
        },
      });
      await auditar(tx, { entidade: 'despesa', entidadeId: id, acao: 'alterar', antes, depois: d });
      return detalhe(tx, id);
    });
  }

  @Delete('despesas/:id')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir despesa' })
  async excluir(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const antes = await tx.despesa.findUnique({ where: { id } });
      if (!antes) throw Erros.naoEncontrado('Despesa não encontrada.');
      exigirAlcance(antes.unidadeId);
      await tx.despesa.delete({ where: { id } });
      await auditar(tx, { entidade: 'despesa', entidadeId: id, acao: 'excluir', antes });
    });
  }
}

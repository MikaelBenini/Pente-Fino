import {
  Controller,
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
import { Prisma } from '@pente-fino/db';
import {
  produtoSchema,
  temAlgumPapel,
  type ProdutoDetalhe,
  type ProdutoEntrada,
} from '@pente-fino/shared';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { TODOS } from '../comum/escopo.js';
import { Corpo } from '../comum/validacao.js';
import { unidadesDoCatalogo } from '../comum/catalogo.js';

function nomeRepetido(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    throw Erros.conflito('Já existe um produto com esse nome.');
  throw e;
}

const forma = (
  p: {
    id: string;
    nome: string;
    categoria: string | null;
    precoVenda: number;
    custo: number;
    ativo: boolean;
    unidadeIds: string[];
  },
  custo: boolean,
): ProdutoDetalhe => ({
  id: p.id,
  nome: p.nome,
  categoria: p.categoria,
  precoVenda: p.precoVenda,
  custo: custo ? p.custo : 0,
  ativo: p.ativo,
  unidadeIds: p.unidadeIds,
});

@ApiTags('Produtos')
@ApiBearerAuth()
@Controller('produtos')
export class ProdutosController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get()
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Produtos à venda (custo só para dono e gestor)' })
  async listar(): Promise<ProdutoDetalhe[]> {
    const custo = temAlgumPapel(Contexto.usuario().papeis, ['dono', 'gestor']);
    const lista = await this.banco.daConta((tx) =>
      tx.produto.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
    );
    return lista.map((p) => forma(p, custo));
  }

  @Post()
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Novo produto' })
  criar(@Corpo(produtoSchema) d: ProdutoEntrada): Promise<ProdutoDetalhe> {
    return this.banco
      .daConta(async (tx) => {
        const unidadeIds = await unidadesDoCatalogo(tx, d.unidadeIds);
        const p = await tx.produto.create({
          data: { ...d, categoria: d.categoria ?? null, unidadeIds },
        });
        await auditar(tx, { entidade: 'produto', entidadeId: p.id, acao: 'criar', depois: d });
        return forma(p, true);
      })
      .catch(nomeRepetido);
  }

  @Patch(':id')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Alterar produto (não muda comandas já lançadas)' })
  alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(produtoSchema.partial()) d: Partial<ProdutoEntrada>,
  ): Promise<ProdutoDetalhe> {
    return this.banco
      .daConta(async (tx) => {
        const antes = await tx.produto.findUnique({ where: { id } });
        if (!antes) throw Erros.naoEncontrado('Produto não encontrado.');
        const unidadeIds =
          d.unidadeIds === undefined ? undefined : await unidadesDoCatalogo(tx, d.unidadeIds);
        const p = await tx.produto.update({ where: { id }, data: { ...d, unidadeIds } });
        await auditar(tx, {
          entidade: 'produto',
          entidadeId: id,
          acao: 'alterar',
          antes,
          depois: p,
        });
        return forma(p, true);
      })
      .catch(nomeRepetido);
  }
}

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
import { garantirSalariosDoMes, Prisma, type Transacao } from '@pente-fino/db';
import {
  CATEGORIA_SALARIOS,
  categoriaDespesaSchema,
  copiarFixasSchema,
  dataLocal,
  descricaoSalario,
  despesaSchema,
  mesAnteriorDe,
  podeNaUnidade,
  vencimentoNoMesSeguinte,
  type CopiarFixasEntrada,
  type DespesaDetalhe,
  type DespesaEntrada,
  type FixaParaCopiar,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis, ExigeRecurso } from '../auth/decoradores.js';
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

/**
 * Linhas de salário da prévia (decisão do dono em 16/11/2026): cada barbeiro ativo no mês com
 * valor fixo em Equipe, que ainda não teve o salário lançado pela cópia neste mês. Lançado à mão
 * (mesma unidade, categoria de salários e o nome dele na descrição): vem desmarcado.
 */
async function salariosParaCopiar(
  tx: Transacao,
  mes: string,
  filtro: Record<string, unknown>,
  doMes: {
    unidadeId: string | null;
    descricao: string;
    profissionalId: string | null;
    categoria: { nome: string };
  }[],
): Promise<FixaParaCopiar[]> {
  const inicio = data(`${mes}-01`);
  const profissionais = await tx.profissional.findMany({
    where: {
      ...filtro,
      ativo: true,
      custoFixoMensal: { gt: 0 },
      OR: [{ dataSaida: null }, { dataSaida: { gte: inicio } }],
    },
    include: { usuario: { select: { nome: true } } },
    orderBy: { usuario: { nome: 'asc' } },
  });
  const jaVieram = new Set(doMes.map((d) => d.profissionalId).filter(Boolean));
  return profissionais
    .filter((p) => !jaVieram.has(p.id))
    .map((p) => ({
      origemId: null,
      profissionalId: p.id,
      unidadeId: p.unidadeId,
      categoria: CATEGORIA_SALARIOS,
      descricao: descricaoSalario(p.usuario.nome),
      valor: p.custoFixoMensal,
      vencimento: null,
      repetir: false,
      jaLancada: doMes.some(
        (d) =>
          d.unidadeId === p.unidadeId &&
          d.categoria.nome === CATEGORIA_SALARIOS &&
          d.descricao.toLowerCase().includes(p.usuario.nome.toLowerCase()),
      ),
    }));
}

/** Lança o salário do barbeiro no mês; já lançado (clique duplo): devolve nulo. */
async function lancarSalario(
  tx: Transacao,
  mes: string,
  profissionalId: string,
  item: { valor: number; vencimento: string | null },
): Promise<string | null> {
  const p = await tx.profissional.findUnique({
    where: { id: profissionalId },
    include: { usuario: { select: { nome: true } } },
  });
  if (!p) throw Erros.naoEncontrado('Profissional não encontrado.');
  exigirAlcance(p.unidadeId);
  const competencia = data(`${mes}-01`);
  if (await tx.despesa.findFirst({ where: { profissionalId, competencia }, select: { id: true } }))
    return null;
  const categoria =
    (await tx.categoriaDespesa.findFirst({ where: { nome: CATEGORIA_SALARIOS } })) ??
    (await tx.categoriaDespesa.create({ data: { nome: CATEGORIA_SALARIOS, grupo: 'fixa' } }));
  const nova = await tx.despesa.create({
    data: {
      unidadeId: p.unidadeId,
      categoriaId: categoria.id,
      descricao: descricaoSalario(p.usuario.nome),
      valor: item.valor,
      competencia,
      vencimento: item.vencimento ? data(item.vencimento) : null,
      profissionalId,
    },
  });
  await auditar(tx, {
    entidade: 'despesa',
    entidadeId: nova.id,
    acao: 'copiar_salario',
    antes: { profissional: profissionalId, valorCadastrado: p.custoFixoMensal },
    depois: { valor: item.valor, competencia: mes },
  });
  return nova.id;
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
    repetir: d.repetir,
  };
}

@ApiTags('Despesas')
@ApiBearerAuth()
// Plano Agenda: comanda, caixa, despesas e resultados vêm do Básico em diante.
@ExigeRecurso('operacao')
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
      // No mês atual, o salário dos barbeiros com valor fixo já aparece como despesa fixa
      // (pedido do dono em 16/11/2026); nunca duplica.
      if (c.mes === dataLocal(new Date()).slice(0, 7)) await garantirSalariosDoMes(tx, c.mes);
      const lista = await tx.despesa.findMany({
        where: { competencia: data(`${c.mes}-01`), ...(incluiConta && !c.unidadeId ? {} : filtro) },
        orderBy: [{ pago: 'asc' }, { vencimento: 'asc' }, { descricao: 'asc' }],
        select: { id: true },
      });
      return umPorVez(lista, (d) => detalhe(tx, d.id));
    });
  }

  @Get('despesas/fixas-para-copiar')
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Prévia do "Copiar fixas do mês anterior": as fixas que ainda não vieram para o mês',
  })
  async fixasParaCopiar(
    @Consulta(consulta) c: z.infer<typeof consulta>,
  ): Promise<FixaParaCopiar[]> {
    const { filtro, incluiConta } = escopoUnidades(c.unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      const origens = await tx.despesa.findMany({
        where: {
          competencia: data(`${mesAnteriorDe(c.mes)}-01`),
          categoria: { grupo: 'fixa' },
          copia: null,
          // O salário vem do cadastro do barbeiro (linhas abaixo), nunca da despesa do mês passado.
          profissionalId: null,
          ...(incluiConta && !c.unidadeId ? {} : filtro),
        },
        include: { categoria: true },
        orderBy: [{ vencimento: 'asc' }, { descricao: 'asc' }],
      });
      // Lançada à mão neste mês (sem a ligação da cópia): vem desmarcada na prévia.
      const doMes = await tx.despesa.findMany({
        where: { competencia: data(`${c.mes}-01`) },
        select: {
          categoriaId: true,
          unidadeId: true,
          descricao: true,
          profissionalId: true,
          categoria: { select: { nome: true } },
        },
      });
      const chave = (d: { categoriaId: string; unidadeId: string | null; descricao: string }) =>
        `${d.categoriaId}|${d.unidadeId ?? ''}|${d.descricao.trim().toLowerCase()}`;
      const existentes = new Set(doMes.map(chave));
      const fixas: FixaParaCopiar[] = origens.map((o) => ({
        origemId: o.id,
        profissionalId: null,
        unidadeId: o.unidadeId,
        categoria: o.categoria.nome,
        descricao: o.descricao,
        valor: o.valor,
        vencimento: vencimentoNoMesSeguinte(o.vencimento ? dataTexto(o.vencimento) : null),
        repetir: o.repetir,
        jaLancada: existentes.has(chave(o)),
      }));
      return [...fixas, ...(await salariosParaCopiar(tx, c.mes, filtro, doMes))];
    });
  }

  @Post('despesas/copiar-fixas')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Copiar para o mês as fixas do mês anterior que a pessoa confirmou' })
  copiarFixas(@Corpo(copiarFixasSchema) d: CopiarFixasEntrada): Promise<DespesaDetalhe[]> {
    return this.banco.daConta(async (tx) => {
      const anterior = data(`${mesAnteriorDe(d.mes)}-01`);
      const criadas: string[] = [];
      for (const item of d.itens) {
        if (item.profissionalId) {
          const id = await lancarSalario(tx, d.mes, item.profissionalId, item);
          if (id) criadas.push(id);
          continue;
        }
        const o = await tx.despesa.findUnique({
          where: { id: item.origemId! },
          include: { copia: { select: { id: true } } },
        });
        if (!o || o.competencia.getTime() !== anterior.getTime())
          throw Erros.naoEncontrado('Despesa do mês anterior não encontrada.');
        exigirAlcance(o.unidadeId);
        // Já veio (cópia manual ou "repetir"): não lança de novo.
        if (o.copia) continue;
        const nova = await tx.despesa.create({
          data: {
            unidadeId: o.unidadeId,
            categoriaId: o.categoriaId,
            descricao: o.descricao,
            valor: item.valor,
            competencia: data(`${d.mes}-01`),
            vencimento: item.vencimento ? data(item.vencimento) : null,
            repetir: o.repetir,
            origemId: o.id,
          },
        });
        await auditar(tx, {
          entidade: 'despesa',
          entidadeId: nova.id,
          acao: 'copiar_fixa',
          antes: { origem: o.id, valor: o.valor },
          depois: { valor: item.valor, competencia: d.mes },
        });
        criadas.push(nova.id);
      }
      // Tudo já tinha vindo (clique duplo, ou a rotina do "repetir" chegou antes).
      if (criadas.length === 0)
        throw Erros.conflito('Essas despesas já foram copiadas para este mês.');
      return umPorVez(criadas, (id) => detalhe(tx, id));
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
          repetir: d.repetir,
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
          repetir: d.repetir,
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

import {
  Controller,
  Delete,
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
import {
  metaSchema,
  periodoSchema,
  porCanal,
  tratarAvaliacaoSchema,
  type TratarAvaliacaoEntrada,
  type LinhaCanal,
  type MetaEntrada,
  type ResumoAvaliacoes,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { resumoAvaliacoes } from '../avaliacoes/avaliacoes.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, exigirUnidade, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';
import { escopoUnidades, ResultadosService } from './resultados.service.js';

const consultaMetas = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, { error: 'Mês inválido.' }),
  unidadeId: z.uuid().optional(),
});

@ApiTags('Indicadores e metas')
@ApiBearerAuth()
@Controller()
export class ResultadosController {
  constructor(
    @Inject(ResultadosService) private readonly servico: ResultadosService,
    @Inject(BancoService) private readonly banco: BancoService,
  ) {}

  @Get('indicadores')
  @Papeis('dono', 'gestor')
  @ApiOperation({
    summary: 'Faturamento, clientes, ticket, atendimentos, extras, % despesas, lucro e projeção',
  })
  indicadores(@Consulta(periodoSchema) p: z.infer<typeof periodoSchema>) {
    return this.servico.indicadores(p.unidadeId, p.de, p.ate);
  }

  @Get('avaliacoes')
  @Papeis('dono', 'gestor')
  @ApiOperation({
    summary: 'Notas do atendimento e da barbearia, notas baixas e comentários do período',
  })
  avaliacoes(@Consulta(periodoSchema) p: z.infer<typeof periodoSchema>): Promise<ResumoAvaliacoes> {
    const { filtro } = escopoUnidades(p.unidadeId, ['dono', 'gestor']);
    return this.banco.daConta((tx) => resumoAvaliacoes(tx, filtro, p.de, p.ate));
  }

  @Post('avaliacoes/:id/tratar')
  @Papeis('dono', 'gestor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar a nota baixa como resolvida, com o que foi feito' })
  tratar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(tratarAvaliacaoSchema) d: TratarAvaliacaoEntrada,
  ): Promise<void> {
    return this.banco.daConta(async (tx) => {
      const a = await tx.avaliacao.findUnique({ where: { id } });
      if (!a) throw Erros.naoEncontrado('Avaliação não encontrada.');
      exigirUnidade(a.unidadeId, ['dono', 'gestor']);
      if (a.status !== 'respondida') throw Erros.conflito('Esta avaliação não foi respondida.');
      const agora = new Date();
      await tx.avaliacao.update({
        where: { id },
        data: { tratadaEm: agora, tratadaPorId: Contexto.usuario().id, tratamento: d.anotacao },
      });
      await auditar(tx, {
        entidade: 'avaliacao',
        entidadeId: id,
        acao: 'tratar_nota_baixa',
        antes: { tratamento: a.tratamento },
        depois: { tratamento: d.anotacao },
      });
    });
  }

  @Get('canais')
  @Papeis('dono', 'gestor')
  @ApiOperation({
    summary: 'Por onde os clientes marcam: agendados, atendidos, faltas e faturamento por canal',
  })
  canais(@Consulta(periodoSchema) p: z.infer<typeof periodoSchema>): Promise<LinhaCanal[]> {
    const { filtro } = escopoUnidades(p.unidadeId, ['dono', 'gestor']);
    const periodo = {
      gte: new Date(`${p.de}T00:00:00-03:00`),
      lt: new Date(new Date(`${p.ate}T00:00:00-03:00`).getTime() + 86_400_000),
    };
    return this.banco.daConta(async (tx) => {
      const agendamentos = await tx.agendamento.findMany({
        where: { ...filtro, inicio: periodo },
        select: {
          origem: true,
          status: true,
          comanda: { select: { status: true, totalLiquido: true } },
        },
      });
      const semHorario = await tx.comanda.findMany({
        where: { ...filtro, status: 'fechada', agendamentoId: null, fechadaEm: periodo },
        select: { totalLiquido: true },
      });
      return porCanal(
        agendamentos.map((a) => ({
          origem: a.origem,
          status: a.status,
          comanda: a.comanda
            ? { status: a.comanda.status, totalLiquido: a.comanda.totalLiquido ?? 0 }
            : null,
        })),
        semHorario.map((c) => ({ totalLiquido: c.totalLiquido ?? 0 })),
      );
    });
  }

  @Get('lucratividade')
  @Papeis('dono', 'gestor')
  @ApiOperation({ summary: 'Lucro e margem por serviço (receita − custo de produto − comissão)' })
  lucratividade(@Consulta(periodoSchema) p: z.infer<typeof periodoSchema>) {
    return this.servico.lucratividade(p.unidadeId, p.de, p.ate);
  }

  @Get('metas')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Metas do mês com o atual calculado' })
  metas(@Consulta(consultaMetas) c: z.infer<typeof consultaMetas>) {
    const { filtro } = escopoUnidades(c.unidadeId, TODOS);
    return this.banco.daConta((tx) => this.servico.metas(tx, c.mes, filtro));
  }

  @Put('metas')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Definir meta do mês (substitui a mesma meta, se existir)' })
  definir(@Corpo(metaSchema) m: MetaEntrada) {
    exigirUnidade(m.unidadeId, ['dono']);
    return this.banco.daConta(async (tx) => {
      if (!(await tx.unidade.findUnique({ where: { id: m.unidadeId } })))
        throw Erros.naoEncontrado('Unidade não encontrada.');
      if (m.servicoId && !(await tx.servico.findUnique({ where: { id: m.servicoId } })))
        throw Erros.naoEncontrado('Serviço não encontrado.');
      const existente = await tx.meta.findFirst({
        where: {
          unidadeId: m.unidadeId,
          mes: data(`${m.mes}-01`),
          tipo: m.tipo,
          servicoId: m.servicoId,
        },
      });
      const salva = existente
        ? await tx.meta.update({ where: { id: existente.id }, data: { objetivo: m.objetivo } })
        : await tx.meta.create({
            data: {
              unidadeId: m.unidadeId,
              mes: data(`${m.mes}-01`),
              tipo: m.tipo,
              servicoId: m.servicoId,
              objetivo: m.objetivo,
            },
          });
      await auditar(tx, {
        entidade: 'meta',
        entidadeId: salva.id,
        acao: 'definir',
        antes: existente ? { objetivo: existente.objetivo } : undefined,
        depois: m,
      });
      return (await this.servico.metas(tx, m.mes, { unidadeId: m.unidadeId })).find(
        (x) => x.id === salva.id,
      );
    });
  }

  @Delete('metas/:id')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover meta' })
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.banco.daConta(async (tx) => {
      const meta = await tx.meta.findUnique({ where: { id } });
      if (!meta) throw Erros.naoEncontrado('Meta não encontrada.');
      await tx.meta.delete({ where: { id } });
      await auditar(tx, {
        entidade: 'meta',
        entidadeId: id,
        acao: 'remover',
        antes: { objetivo: meta.objetivo, tipo: meta.tipo },
      });
    });
  }
}

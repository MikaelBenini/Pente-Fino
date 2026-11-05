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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@pente-fino/db';
import {
  diaCalendarioSchema,
  lerRegrasAgendamento,
  regrasAgendamentoSchema,
  type RegrasAgendamento,
  unidadeParcialSchema,
  unidadeSchema,
  verificarLimite,
  type DiaCalendario,
  type DiaCalendarioEntrada,
  type UnidadeDetalhe,
  type UnidadeEntrada,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade, GESTAO, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo, PipeZod } from '../comum/validacao.js';

const SELECAO = {
  id: true,
  nome: true,
  endereco: true,
  telefone: true,
  diasTrabalho: true,
  capacidade: true,
  fuso: true,
  ativa: true,
  slug: true,
  agendamentoPublico: true,
} as const;
const periodoSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' }),
});
const dataParam = new PipeZod(
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida (use AAAA-MM-DD).' }),
);

@ApiTags('Unidades')
@ApiBearerAuth()
@Controller('unidades')
export class UnidadesController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get(':id/regras-agendamento')
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Regras de agendamento da unidade (antecedência, janela, prazos, lembretes)',
  })
  regras(@Param('id', ParseUUIDPipe) id: string): Promise<RegrasAgendamento> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await tx.unidade.findUnique({ where: { id } });
      if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
      return lerRegrasAgendamento(u.regrasAgendamento);
    });
  }

  @Put(':id/regras-agendamento')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Gravar as regras de agendamento da unidade (bot e site)' })
  gravarRegras(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(regrasAgendamentoSchema) regras: RegrasAgendamento,
  ): Promise<RegrasAgendamento> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await tx.unidade.findUnique({ where: { id } });
      if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
      await tx.unidade.update({
        where: { id },
        data: { regrasAgendamento: regras as unknown as Prisma.InputJsonValue },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'regras_agendamento',
        antes: lerRegrasAgendamento(u.regrasAgendamento),
        depois: regras,
      });
      return regras;
    });
  }

  @Get()
  @ApiOperation({ summary: 'Unidades que o usuário alcança (papel sem unidade = todas da conta)' })
  listar(): Promise<UnidadeDetalhe[]> {
    const { papeis } = Contexto.usuario();
    const todas = papeis.some((p) => p.unidadeId === null);
    const ids = papeis.map((p) => p.unidadeId).filter((id): id is string => id !== null);
    return this.banco.daConta((tx) =>
      tx.unidade.findMany({
        where: todas ? {} : { id: { in: ids } },
        select: SELECAO,
        orderBy: { nome: 'asc' },
      }),
    );
  }

  @Post()
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Nova unidade (respeita o limite do plano)' })
  criar(@Corpo(unidadeSchema) dados: UnidadeEntrada): Promise<UnidadeDetalhe> {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
      const limite = verificarLimite(
        conta.plano,
        'unidades',
        await tx.unidade.count({ where: { ativa: true } }),
      );
      if (limite) throw Erros.requisicaoInvalida('limite_plano', limite);
      const unidade = await tx.unidade.create({ data: dados, select: SELECAO });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: unidade.id,
        acao: 'criar',
        depois: unidade,
      });
      return unidade;
    });
  }

  @Patch(':unidadeId')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({
    summary: 'Alterar unidade (nome, endereço, dias de trabalho, capacidade, ativa)',
  })
  alterar(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Corpo(unidadeParcialSchema) dados: z.infer<typeof unidadeParcialSchema>,
  ): Promise<UnidadeDetalhe> {
    return this.banco.daConta(async (tx) => {
      const antes = await tx.unidade.findUnique({ where: { id: unidadeId }, select: SELECAO });
      if (!antes) throw Erros.naoEncontrado('Unidade não encontrada.');
      if (dados.ativa === true && !antes.ativa) {
        const conta = await tx.conta.findUniqueOrThrow({
          where: { id: Contexto.usuario().contaId },
        });
        const limite = verificarLimite(
          conta.plano,
          'unidades',
          await tx.unidade.count({ where: { ativa: true } }),
        );
        if (limite) throw Erros.requisicaoInvalida('limite_plano', limite);
      }
      const slugFinal = dados.slug ?? antes.slug;
      if ((dados.agendamentoPublico ?? antes.agendamentoPublico) && !slugFinal) {
        throw Erros.validacao([
          {
            campo: 'slug',
            mensagem: 'Defina o endereço do link antes de ligar o agendamento público.',
          },
        ]);
      }
      const depois = await tx.unidade.update({
        where: { id: unidadeId },
        data: dados,
        select: SELECAO,
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: unidadeId,
        acao: 'alterar',
        antes,
        depois,
      });
      return depois;
    });
  }

  @Get(':unidadeId/calendario')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Folgas, feriados e dias extras da unidade no período' })
  calendario(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Consulta(periodoSchema) { de, ate }: z.infer<typeof periodoSchema>,
  ): Promise<DiaCalendario[]> {
    return this.banco.daConta(async (tx) => {
      const dias = await tx.calendarioUnidade.findMany({
        where: { unidadeId, data: { gte: data(de), lte: data(ate) } },
        orderBy: { data: 'asc' },
      });
      return dias.map((d) => ({ data: dataTexto(d.data), trabalha: d.trabalha, motivo: d.motivo }));
    });
  }

  @Put(':unidadeId/calendario/:data')
  @Papeis(...GESTAO)
  @ApiOperation({
    summary: 'Marcar um dia como folga/feriado (trabalha: false) ou dia extra (true)',
  })
  marcarDia(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Param('data', dataParam) dia: string,
    @Corpo(diaCalendarioSchema) dados: DiaCalendarioEntrada,
  ): Promise<DiaCalendario> {
    exigirUnidade(unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      if (!(await tx.unidade.findUnique({ where: { id: unidadeId } })))
        throw Erros.naoEncontrado('Unidade não encontrada.');
      const r = await tx.calendarioUnidade.upsert({
        where: { unidadeId_data: { unidadeId, data: data(dia) } },
        create: {
          unidadeId,
          data: data(dia),
          trabalha: dados.trabalha,
          motivo: dados.motivo ?? null,
        },
        update: { trabalha: dados.trabalha, motivo: dados.motivo ?? null },
      });
      return { data: dataTexto(r.data), trabalha: r.trabalha, motivo: r.motivo };
    });
  }

  @Delete(':unidadeId/calendario/:data')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Voltar o dia ao expediente normal da unidade' })
  async desmarcarDia(
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Param('data', dataParam) dia: string,
  ): Promise<void> {
    exigirUnidade(unidadeId, GESTAO);
    await this.banco.daConta((tx) =>
      tx.calendarioUnidade.deleteMany({ where: { unidadeId, data: data(dia) } }),
    );
  }
}

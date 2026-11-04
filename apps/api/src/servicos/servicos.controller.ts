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
  dataLocal,
  novosPrecosSchema,
  servicoSchema,
  temAlgumPapel,
  type NovosPrecosEntrada,
  type PrecoVigente,
  type ServicoDetalhe,
  type ServicoEntrada,
  type TabelaPrecos,
} from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, dataTexto, filtroUnidade, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo } from '../comum/validacao.js';

const servicoParcialSchema = servicoSchema.partial();
const consultaPrecosSchema = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Data inválida.' })
    .optional(),
});

/** Recepção e barbeiro veem preço, mas não custo (docs: matriz de permissões). */
function podeVerCusto(): boolean {
  return temAlgumPapel(Contexto.usuario().papeis, ['dono', 'gestor']);
}

function nomeRepetido(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw Erros.conflito('Já existe um serviço com esse nome.');
  }
  throw e;
}

@ApiTags('Serviços e preços')
@ApiBearerAuth()
@Controller()
export class ServicosController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get('servicos')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Catálogo de serviços (custo só para dono e gestor)' })
  async listar(): Promise<ServicoDetalhe[]> {
    const servicos = await this.banco.daConta((tx) =>
      tx.servico.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
    );
    const custo = podeVerCusto();
    return servicos.map((s) => ({
      id: s.id,
      nome: s.nome,
      categoria: s.categoria,
      duracaoMin: s.duracaoMin,
      custoProduto: custo ? s.custoProduto : 0,
      ehExtra: s.ehExtra,
      pesoAtendimento: s.pesoAtendimento,
      ativo: s.ativo,
    }));
  }

  @Post('servicos')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Novo serviço' })
  async criar(@Corpo(servicoSchema) dados: ServicoEntrada): Promise<ServicoDetalhe> {
    return this.banco
      .daConta(async (tx) => {
        const s = await tx.servico.create({ data: dados });
        await auditar(tx, { entidade: 'servico', entidadeId: s.id, acao: 'criar', depois: dados });
        return { ...dados, id: s.id };
      })
      .catch(nomeRepetido);
  }

  @Patch('servicos/:id')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Alterar serviço (não muda comandas já lançadas)' })
  async alterar(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(servicoParcialSchema) dados: z.infer<typeof servicoParcialSchema>,
  ): Promise<ServicoDetalhe> {
    return this.banco
      .daConta(async (tx) => {
        const antes = await tx.servico.findUnique({ where: { id } });
        if (!antes) throw Erros.naoEncontrado('Serviço não encontrado.');
        const s = await tx.servico.update({ where: { id }, data: dados });
        await auditar(tx, {
          entidade: 'servico',
          entidadeId: id,
          acao: 'alterar',
          antes,
          depois: s,
        });
        return {
          id: s.id,
          nome: s.nome,
          categoria: s.categoria,
          duracaoMin: s.duracaoMin,
          custoProduto: s.custoProduto,
          ehExtra: s.ehExtra,
          pesoAtendimento: s.pesoAtendimento,
          ativo: s.ativo,
        };
      })
      .catch(nomeRepetido);
  }

  @Get('precos')
  @Papeis(...TODOS)
  @ApiOperation({
    summary: 'Tabela de preços vigente numa data (padrão: hoje) e mudanças programadas',
  })
  async tabela(
    @Consulta(consultaPrecosSchema) consulta: z.infer<typeof consultaPrecosSchema>,
  ): Promise<TabelaPrecos> {
    const dia = consulta.data ?? dataLocal(new Date());
    const precos = await this.banco.daConta((tx) =>
      tx.precoServico.findMany({
        where: filtroUnidade(TODOS),
        orderBy: { vigenciaInicio: 'desc' },
      }),
    );
    const vigentes = new Map<string, PrecoVigente>();
    const programados: PrecoVigente[] = [];
    for (const p of precos) {
      const linha = {
        servicoId: p.servicoId,
        unidadeId: p.unidadeId,
        valor: p.valor,
        vigenciaInicio: dataTexto(p.vigenciaInicio),
      };
      if (linha.vigenciaInicio > dia) programados.push(linha);
      else if (!vigentes.has(`${p.servicoId}|${p.unidadeId}`))
        vigentes.set(`${p.servicoId}|${p.unidadeId}`, linha);
    }
    return { data: dia, vigentes: [...vigentes.values()], programados: programados.reverse() };
  }

  @Get('servicos/:id/precos')
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Histórico de preços do serviço por unidade' })
  async historico(@Param('id', ParseUUIDPipe) id: string): Promise<PrecoVigente[]> {
    const precos = await this.banco.daConta((tx) =>
      tx.precoServico.findMany({
        where: { servicoId: id, ...filtroUnidade(TODOS) },
        orderBy: { vigenciaInicio: 'desc' },
      }),
    );
    return precos.map((p) => ({
      servicoId: p.servicoId,
      unidadeId: p.unidadeId,
      valor: p.valor,
      vigenciaInicio: dataTexto(p.vigenciaInicio),
    }));
  }

  @Post('precos')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Novos preços a partir de uma data (hoje ou depois). O passado não muda.',
  })
  async novosPrecos(
    @Corpo(novosPrecosSchema) { vigenciaInicio, precos }: NovosPrecosEntrada,
  ): Promise<{ gravados: number }> {
    if (vigenciaInicio < dataLocal(new Date())) {
      throw Erros.validacao([
        {
          campo: 'vigenciaInicio',
          mensagem: 'O novo preço vale de hoje em diante; o passado não muda.',
        },
      ]);
    }
    return this.banco.daConta(async (tx) => {
      const servicos = new Set(precos.map((p) => p.servicoId));
      const unidades = new Set(precos.map((p) => p.unidadeId));
      const [nServ, nUni] = await Promise.all([
        tx.servico.count({ where: { id: { in: [...servicos] } } }),
        tx.unidade.count({ where: { id: { in: [...unidades] } } }),
      ]);
      if (nServ !== servicos.size || nUni !== unidades.size)
        throw Erros.naoEncontrado('Serviço ou unidade não encontrado.');

      for (const p of precos) {
        await tx.precoServico.upsert({
          where: {
            contaId_servicoId_unidadeId_vigenciaInicio: {
              contaId: Contexto.usuario().contaId,
              servicoId: p.servicoId,
              unidadeId: p.unidadeId,
              vigenciaInicio: data(vigenciaInicio),
            },
          },
          create: {
            servicoId: p.servicoId,
            unidadeId: p.unidadeId,
            valor: p.valor,
            vigenciaInicio: data(vigenciaInicio),
          },
          update: { valor: p.valor },
        });
      }
      await auditar(tx, {
        entidade: 'preco_servico',
        entidadeId: Contexto.usuario().contaId,
        acao: 'novos_precos',
        depois: { vigenciaInicio, precos },
      });
      return { gravados: precos.length };
    });
  }
}

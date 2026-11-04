import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MODELO_SERVICOS } from '@pente-fino/db';
import { dataLocal, servicoSchema } from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data } from '../comum/escopo.js';
import { Corpo } from '../comum/validacao.js';
import { emSequencia } from '../comum/sequencia.js';

const servicosIniciaisSchema = z.object({
  servicos: z
    .array(servicoSchema.extend({ preco: z.number().int().min(0).max(10_000_000) }))
    .min(1, { error: 'Escolha pelo menos um serviço.' })
    .max(60),
});

export interface EstadoConfiguracao {
  configurada: boolean;
  unidades: number;
  servicos: number;
  servicosComPreco: number;
  profissionais: number;
  /** Modelos sugeridos (nome, duração, custo, extra, peso e preço). */
  modelos: typeof MODELO_SERVICOS;
}

@ApiTags('Configuração guiada')
@ApiBearerAuth()
@Controller('configuracao')
export class ConfiguracaoController {
  constructor(@Inject(BancoService) private readonly banco: BancoService) {}

  @Get('estado')
  @Papeis('dono', 'gestor')
  @ApiOperation({ summary: 'Em que ponto está a configuração da conta' })
  estado(): Promise<EstadoConfiguracao> {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
      const [unidades, servicos, comPreco, profissionais] = await emSequencia([
        tx.unidade.count({ where: { ativa: true } }),
        tx.servico.count({ where: { ativo: true } }),
        tx.servico.count({ where: { ativo: true, precos: { some: {} } } }),
        tx.profissional.count({ where: { ativo: true } }),
      ]);
      return {
        configurada: conta.configuradaEm !== null,
        unidades,
        servicos,
        servicosComPreco: comPreco,
        profissionais,
        modelos: MODELO_SERVICOS,
      };
    });
  }

  @Post('servicos')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar os serviços escolhidos com preço em todas as unidades (a partir de hoje)',
  })
  servicos(@Corpo(servicosIniciaisSchema) { servicos }: z.infer<typeof servicosIniciaisSchema>) {
    const hoje = dataLocal(new Date());
    return this.banco.daConta(async (tx) => {
      const unidades = await tx.unidade.findMany({ where: { ativa: true } });
      const existentes = new Set(
        (await tx.servico.findMany({ select: { nome: true } })).map((s) => s.nome.toLowerCase()),
      );
      const repetidos = servicos
        .filter((s) => existentes.has(s.nome.toLowerCase()))
        .map((s) => s.nome);
      if (repetidos.length) throw Erros.conflito(`Já cadastrado: ${repetidos.join(', ')}.`);
      for (const { preco, ...dados } of servicos) {
        const s = await tx.servico.create({ data: dados });
        await tx.precoServico.createMany({
          data: unidades.map((u) => ({
            servicoId: s.id,
            unidadeId: u.id,
            valor: preco,
            vigenciaInicio: data(hoje),
          })),
        });
      }
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: Contexto.usuario().contaId,
        acao: 'servicos_iniciais',
        depois: { servicos: servicos.map((s) => s.nome) },
      });
      return { criados: servicos.length };
    });
  }

  @Post('concluir')
  @Papeis('dono')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar a configuração guiada como concluída' })
  concluir() {
    return this.banco.daConta(async (tx) => {
      await tx.conta.update({
        where: { id: Contexto.usuario().contaId },
        data: { configuradaEm: new Date() },
      });
      return { configurada: true };
    });
  }
}

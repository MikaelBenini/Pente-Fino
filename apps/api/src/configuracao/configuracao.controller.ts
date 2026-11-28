import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MODELO_SERVICOS, modelosDeServico, Prisma } from '@pente-fino/db';
import {
  dataLocal,
  mensagensBotPadrao,
  menuBotPadrao,
  SEGMENTOS,
  SEGMENTOS_DA_LICENCA,
  segmentoNaLicenca,
  servicoSchema,
  vocabulario,
  type Segmento,
} from '@pente-fino/shared';
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

/** JSON com as chaves em ordem: dois objetos iguais dão o mesmo texto, venha de onde vier. */
function jsonOrdenado(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}

export interface EstadoConfiguracao {
  configurada: boolean;
  unidades: number;
  servicos: number;
  servicosComPreco: number;
  profissionais: number;
  /** Modelos sugeridos (nome, duração, custo, extra, peso e preço). */
  modelos: typeof MODELO_SERVICOS;
  /** Tipo de negócio da conta e os que a licença aceita (mais de um: o primeiro acesso pergunta). */
  segmento: Segmento;
  segmentosDaLicenca: readonly Segmento[];
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
        // Os serviços prontos do tipo de negócio da conta (Fase 1b).
        modelos: modelosDeServico(conta.segmento),
        segmento: conta.segmento,
        segmentosDaLicenca: SEGMENTOS_DA_LICENCA[conta.licenca],
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
        const s = await tx.servico.create({
          data: { ...dados, unidadeIds: unidades.map((u) => u.id) },
        });
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

  /**
   * Primeiro acesso (Fase 1b, S7): o dono confirma o tipo de negócio dentro da licença (Beleza:
   * salão ou unhas; Atendimento: qualquer um). Só antes de concluir a configuração; depois, só a
   * administração troca (ADR 0015). O menu e as mensagens prontas do bot que ninguém editou
   * passam para o vocabulário novo.
   */
  @Put('segmento')
  @Papeis('dono')
  @Auditada()
  @ApiOperation({ summary: 'Primeiro acesso: confirmar o tipo de negócio dentro da licença' })
  segmento(@Corpo(z.object({ segmento: z.enum(SEGMENTOS) })) { segmento }: { segmento: Segmento }) {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: Contexto.usuario().contaId } });
      if (conta.configuradaEm)
        throw Erros.conflito(
          'A configuração inicial já foi concluída. Para mudar o tipo de negócio, fale com o suporte.',
        );
      if (!segmentoNaLicenca(conta.licenca, segmento))
        throw Erros.validacao([
          { campo: 'segmento', mensagem: 'Esse tipo de negócio não faz parte da sua licença.' },
        ]);
      const antes = vocabulario(conta.segmento);
      const depois = vocabulario(segmento);
      await tx.conta.update({ where: { id: conta.id }, data: { segmento } });
      // Bot: troca só o que ainda é o texto pronto do vocabulário anterior.
      // O banco (JSONB) guarda as chaves em outra ordem: compara com as chaves ordenadas.
      const menuAntigo = jsonOrdenado(menuBotPadrao(antes));
      for (const m of await tx.botMenu.findMany({ where: { unidadeId: null } }))
        if (jsonOrdenado(m.menu) === menuAntigo)
          await tx.botMenu.update({
            where: { id: m.id },
            data: { menu: menuBotPadrao(depois) as unknown as Prisma.InputJsonValue },
          });
      const msgAntigas = mensagensBotPadrao(antes);
      const msgNovas = mensagensBotPadrao(depois);
      for (const [tipo, texto] of Object.entries(msgAntigas))
        await tx.modeloMensagem.updateMany({
          where: { unidadeId: null, tipo: tipo as never, texto },
          data: { texto: msgNovas[tipo as keyof typeof msgNovas] },
        });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: conta.id,
        acao: 'segmento_inicial',
        antes: { segmento: conta.segmento },
        depois: { segmento },
      });
      return { segmento, modelos: modelosDeServico(segmento) };
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

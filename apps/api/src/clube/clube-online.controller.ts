// Rotas do clube online: conta para receber e repasses (dono), link de cada plano (balcão) e o
// link público onde o cliente assina.
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  assinarClubeSchema,
  dadosRecebimentoSchema,
  planosSugeridos,
  slugSchema,
  textoConviteClube,
  type AssinarClubeEntrada,
  type ClubeParaAssinar,
  type DadosRecebimento,
  type RecebimentoClube,
  type RecebimentoNaTela,
} from '@pente-fino/shared';
import { precoServicoVigente } from '@pente-fino/db';
import { dataLocal } from '@pente-fino/shared';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { ExigeRecurso, LimiteAutenticacao, Papeis, Publico } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { exigirUnidade } from '../comum/escopo.js';
import { Consulta, Corpo, PipeZod } from '../comum/validacao.js';
import { ClubeOnlineService } from './clube-online.service.js';

const consultaMes = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) });
const planosSugeridosSchema = z.object({ unidadeId: z.uuid() });
const slugParam = new PipeZod(slugSchema);

@ApiTags('Clube')
@ApiBearerAuth()
@ExigeRecurso('clube', { soEscrita: true })
@Controller('clube')
export class ClubeOnlineController {
  constructor(
    @Inject(ClubeOnlineService) private readonly online: ClubeOnlineService,
    @Inject(BancoService) private readonly banco: BancoService,
  ) {}

  @Get('recebimento')
  @Papeis('dono')
  @ApiOperation({ summary: 'Conta para receber o clube online: situação no Asaas, taxa e saldo' })
  recebimento(): Promise<RecebimentoNaTela> {
    return this.online.recebimento();
  }

  @Post('recebimento')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar a conta para receber (subconta do Asaas com os dados da barbearia)',
  })
  criarRecebimento(@Corpo(dadosRecebimentoSchema) d: DadosRecebimento): Promise<RecebimentoNaTela> {
    return this.online.criarRecebimento(d);
  }

  @Get('recebimento/documentos')
  @Papeis('dono')
  @ApiOperation({ summary: 'Página do Asaas para enviar os documentos da conta' })
  async documentos(): Promise<{ link: string | null }> {
    return { link: await this.online.linkDocumentos() };
  }

  @Get('recebimentos')
  @Papeis('dono', 'gestor')
  @ApiOperation({ summary: 'Mensalidades pagas pelo link no mês, com taxas e repasse' })
  recebimentos(@Consulta(consultaMes) q: z.infer<typeof consultaMes>): Promise<RecebimentoClube[]> {
    return this.online.recebimentos(q.mes);
  }

  @Get('itens/:id/link')
  @Papeis('dono', 'gestor', 'recepcao')
  @ApiOperation({ summary: 'Link de assinatura do plano e a mensagem pronta para o WhatsApp' })
  async link(@Param('id', ParseUUIDPipe) id: string): Promise<{ link: string; mensagem: string }> {
    return this.banco.daConta(async (tx) => {
      const p = await tx.itemClube.findUnique({ where: { id }, include: { unidade: true } });
      if (!p) throw Erros.naoEncontrado('Plano não encontrado.');
      exigirUnidade(p.unidadeId, ['dono', 'gestor', 'recepcao']);
      if (!(await tx.recebimentoOnline.findFirst()))
        throw Erros.conflito(
          'Para mandar o link, o dono ativa o clube online em Clube → Receber online.',
        );
      if (!p.unidade.slug)
        throw Erros.conflito(
          'Defina o endereço da unidade em Configurações → Link de agendamento para gerar o link.',
        );
      const conta = await tx.conta.findFirstOrThrow();
      const link = this.online.linkDoPlano(p.unidade.slug, p.id);
      return {
        link,
        mensagem: textoConviteClube({ barbearia: conta.nome, plano: p.nome, valor: p.valor, link }),
      };
    });
  }

  @Post('planos-sugeridos')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar os planos sugeridos a partir dos serviços e preços da unidade' })
  async sugeridos(
    @Corpo(planosSugeridosSchema) d: z.infer<typeof planosSugeridosSchema>,
  ): Promise<{ criados: number }> {
    return this.banco.daConta(async (tx) => {
      exigirUnidade(d.unidadeId, ['dono']);
      const servicos = await tx.servico.findMany({ where: { ativo: true, ehExtra: false } });
      const hoje = dataLocal(new Date());
      const comPreco: { id: string; nome: string; preco: number }[] = [];
      for (const s of servicos) {
        const preco = await precoServicoVigente(tx, s.id, d.unidadeId, hoje);
        if (preco !== undefined) comPreco.push({ id: s.id, nome: s.nome, preco });
      }
      const sugestoes = planosSugeridos(comPreco);
      if (sugestoes.length === 0)
        throw Erros.conflito(
          'Cadastre o serviço "Corte" com preço nesta unidade para receber sugestões.',
        );
      const existentes = new Set(
        (
          await tx.itemClube.findMany({ where: { unidadeId: d.unidadeId }, select: { nome: true } })
        ).map((p) => p.nome),
      );
      let criados = 0;
      for (const s of sugestoes) {
        if (existentes.has(s.nome)) continue;
        const p = await tx.itemClube.create({
          data: {
            unidadeId: d.unidadeId,
            tipo: 'assinatura',
            nome: s.nome,
            descricao: s.descricao,
            valor: s.valor,
            servicos: {
              create: s.servicos.map((x) => ({ servicoId: x.servicoId, quantidade: x.quantidade })),
            },
          },
        });
        await auditar(tx, {
          entidade: 'item_clube',
          entidadeId: p.id,
          acao: 'criar',
          depois: { nome: s.nome, valor: s.valor, sugerido: true },
        });
        criados++;
      }
      return { criados };
    });
  }
}

@ApiTags('Público')
@Controller('publico/clube')
export class ClubePublicoController {
  constructor(@Inject(ClubeOnlineService) private readonly online: ClubeOnlineService) {}

  @Get(':slug')
  @Publico()
  @ApiOperation({ summary: 'Planos do clube para assinar pelo link' })
  clube(@Param('slug', slugParam) slug: string): Promise<ClubeParaAssinar> {
    return this.online.clubeParaAssinar(slug);
  }

  @Post(':slug/assinar')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assinar um plano: devolve a página de pagamento do Asaas' })
  assinar(
    @Param('slug', slugParam) slug: string,
    @Corpo(assinarClubeSchema) d: AssinarClubeEntrada,
  ): Promise<{ link: string }> {
    return this.online.assinar(slug, d);
  }
}

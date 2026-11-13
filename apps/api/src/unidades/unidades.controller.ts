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
import { precoServicoVigente, Prisma } from '@pente-fino/db';
import {
  dataLocal,
  diaCalendarioSchema,
  faltaParaLigarLink,
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
  copiarCatalogoSchema,
  lerSite,
  siteBarbeariaSchema,
  type SiteBarbearia,
  type SitePainel,
  type SitePublico,
} from '@pente-fino/shared';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { Auditada, auditar } from '../auditoria/auditoria.js';
import { Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { ErroApp, Erros } from '../comum/erros.js';
import { data, dataTexto, exigirUnidade, GESTAO, TODOS } from '../comum/escopo.js';
import { Consulta, Corpo, PipeZod } from '../comum/validacao.js';
import { montarSitePublico } from '../publico/site.js';

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
  aparecerNoGoogle: true,
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

  // ─── Site da barbearia (seção 7) ─────────────────────────────────────────

  private async unidadeDoSite(tx: Prisma.TransactionClient, id: string) {
    const u = await tx.unidade.findUnique({ where: { id } });
    if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
    const conta = await tx.conta.findUniqueOrThrow({ where: { id: u.contaId } });
    return { u, rascunho: lerSite(u.siteRascunho, conta.nome) };
  }

  private painelDoSite(
    u: {
      slug: string | null;
      agendamentoPublico: boolean;
      sitePublicado: unknown;
      sitePublicadoEm: Date | null;
    },
    rascunho: SiteBarbearia,
  ): SitePainel {
    return {
      rascunho,
      publicado: u.sitePublicado !== null,
      publicadoEm: u.sitePublicadoEm?.toISOString() ?? null,
      alteracoesPendentes:
        u.sitePublicado === null || !isDeepStrictEqual(u.sitePublicado, rascunho),
      slug: u.slug,
      linkLigado: u.agendamentoPublico,
    };
  }

  @Get(':id/site')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Site da unidade para editar: rascunho (ou o sugerido) e situação' })
  site(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho } = await this.unidadeDoSite(tx, id);
      return this.painelDoSite(u, rascunho);
    });
  }

  @Put(':id/site')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Gravar o rascunho do site (não muda o que o cliente vê)' })
  gravarSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(siteBarbeariaSchema) site: SiteBarbearia,
  ): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u } = await this.unidadeDoSite(tx, id);
      const salvo = await tx.unidade.update({
        where: { id },
        data: { siteRascunho: site as unknown as Prisma.InputJsonValue },
      });
      return this.painelDoSite({ ...u, ...salvo }, site);
    });
  }

  @Get(':id/site/previa')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Prévia do site com o rascunho e os dados vivos da unidade' })
  previaDoSite(@Param('id', ParseUUIDPipe) id: string): Promise<SitePublico> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho } = await this.unidadeDoSite(tx, id);
      return montarSitePublico(tx, u, rascunho);
    });
  }

  @Post(':id/site/publicar')
  @Papeis(...GESTAO)
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publicar o rascunho: /b/<slug> passa a mostrar o site' })
  publicarSite(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho } = await this.unidadeDoSite(tx, id);
      if (!u.slug || !u.agendamentoPublico)
        throw Erros.requisicaoInvalida(
          'link_desligado',
          'Ligue o link de agendamento da unidade antes de publicar o site.',
        );
      const salvo = await tx.unidade.update({
        where: { id },
        data: {
          siteRascunho: rascunho as unknown as Prisma.InputJsonValue,
          sitePublicado: rascunho as unknown as Prisma.InputJsonValue,
          sitePublicadoEm: new Date(),
        },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'site_publicado',
        antes: null,
        depois: { tema: rascunho.tema },
      });
      return this.painelDoSite(salvo, rascunho);
    });
  }

  @Delete(':id/site/publicado')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({
    summary: 'Tirar o site do ar: /b/<slug> volta a ser a página de agendamento (rascunho fica)',
  })
  despublicarSite(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { rascunho } = await this.unidadeDoSite(tx, id);
      const salvo = await tx.unidade.update({
        where: { id },
        data: { sitePublicado: Prisma.DbNull, sitePublicadoEm: null },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'site_despublicado',
        antes: null,
        depois: null,
      });
      return this.painelDoSite(salvo, rascunho);
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

  @Post(':id/copiar-catalogo')
  @Papeis('dono')
  @Auditada()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Copiar o catálogo de outra unidade: serviços (com os preços de hoje) e produtos',
  })
  async copiarCatalogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(copiarCatalogoSchema) d: z.infer<typeof copiarCatalogoSchema>,
  ): Promise<{ servicos: number; produtos: number; precos: number }> {
    if (d.deUnidadeId === id)
      throw Erros.requisicaoInvalida('mesma_unidade', 'Escolha outra unidade para copiar.');
    return this.banco.daConta(async (tx) => {
      const [destino, origem] = await Promise.all([
        tx.unidade.findUnique({ where: { id } }),
        tx.unidade.findUnique({ where: { id: d.deUnidadeId } }),
      ]);
      if (!destino || !origem) throw Erros.naoEncontrado('Unidade não encontrada.');
      const hoje = dataLocal(new Date());
      let servicos = 0;
      let precos = 0;
      for (const sv of await tx.servico.findMany({ where: { unidadeIds: { has: origem.id } } })) {
        if (!sv.unidadeIds.includes(id)) {
          await tx.servico.update({
            where: { id: sv.id },
            data: { unidadeIds: [...sv.unidadeIds, id] },
          });
          servicos++;
        }
        // O preço de hoje da outra unidade, se esta ainda não tem preço para o serviço.
        if ((await precoServicoVigente(tx, sv.id, id, hoje)) === undefined) {
          const valor = await precoServicoVigente(tx, sv.id, origem.id, hoje);
          if (valor !== undefined) {
            await tx.precoServico.create({
              data: { servicoId: sv.id, unidadeId: id, valor, vigenciaInicio: data(hoje) },
            });
            precos++;
          }
        }
      }
      let produtos = 0;
      for (const p of await tx.produto.findMany({ where: { unidadeIds: { has: origem.id } } }))
        if (!p.unidadeIds.includes(id)) {
          await tx.produto.update({
            where: { id: p.id },
            data: { unidadeIds: [...p.unidadeIds, id] },
          });
          produtos++;
        }
      const r = { servicos, produtos, precos };
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'copiar_catalogo',
        depois: { de: origem.id, ...r },
      });
      return r;
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
      // Painel A7: link ligado sem serviço com preço ou sem barbeiro com horário deixa o
      // cliente numa página sem saída. Só confere ao ligar (desligar e mudar o endereço, livres).
      if (dados.agendamentoPublico === true && !antes.agendamentoPublico) {
        const falta = await this.faltaParaOLink(tx, unidadeId);
        if (falta.length > 0)
          throw new ErroApp(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'link_incompleto',
            `Para ligar o link, falta: ${falta.map((f) => f.mensagem).join(' ')}`,
            falta.map((f) => ({ campo: f.item, mensagem: f.mensagem })),
          );
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

  private async faltaParaOLink(tx: Prisma.TransactionClient, unidadeId: string) {
    const hoje = dataLocal(new Date());
    const servicos = await tx.servico.findMany({
      where: { ativo: true, unidadeIds: { has: unidadeId } },
      select: { id: true },
    });
    const profissionaisComHorario = await tx.profissional.count({
      where: { unidadeId, ativo: true, horarios: { some: {} } },
    });
    let servicosComPreco = 0;
    for (const s of servicos) {
      if ((await precoServicoVigente(tx, s.id, unidadeId, hoje)) !== undefined) {
        servicosComPreco = 1;
        break;
      }
    }
    return faltaParaLigarLink({ servicosComPreco, profissionaisComHorario });
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

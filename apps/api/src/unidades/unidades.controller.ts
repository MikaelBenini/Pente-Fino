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
  diasQueAbre,
  horarioFuncionamentoSchema,
  lerFuncionamento,
  type HorarioFuncionamento,
  dominioSchema,
  enderecoSiteSchema,
  type DominioEntrada,
  envioFotoSchema,
  type EnderecoSite,
  fotosDoSite,
  fotosDoVisual,
  lerSite,
  lerVisualAgendamento,
  siteBarbeariaSchema,
  visualAgendamentoInicial,
  visualAgendamentoSchema,
  type VisualAgendamento,
  type EnvioFoto,
  type FotoEnviada,
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
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { gravarFoto, processarFoto } from '../site/fotos.js';
import { dominioApontado, dominioEmUso, ipsDoServidor } from '../site/dominio.js';
import {
  registrarTrocaDeEndereco,
  siteSlugEmUso,
  siteSlugLivre,
  sugestaoDeSiteSlug,
} from '../site/enderecos.js';

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
/** Fotos enviadas por unidade (cada uma ocupa uns 300 KB no disco). */
const LIMITE_FOTOS_UNIDADE = 300;

/** Site gravado, ou null quando não há (não cria o sugerido). */
const lerSiteOuNulo = (valor: unknown) =>
  valor === null || valor === undefined
    ? null
    : (siteBarbeariaSchema.safeParse(valor).data ?? null);

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
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  @Get(':id/funcionamento')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Horário de funcionamento da unidade (turnos por dia da semana)' })
  funcionamento(@Param('id', ParseUUIDPipe) id: string): Promise<HorarioFuncionamento> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await tx.unidade.findUnique({ where: { id } });
      if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
      return { turnos: lerFuncionamento(u.horarioFuncionamento) };
    });
  }

  @Put(':id/funcionamento')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({
    summary:
      'Gravar o horário de funcionamento: o agendamento só oferece horário dentro dele (vazio = sem limite)',
  })
  gravarFuncionamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(horarioFuncionamentoSchema) dados: HorarioFuncionamento,
  ): Promise<HorarioFuncionamento> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await tx.unidade.findUnique({ where: { id } });
      if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
      const turnos = [...dados.turnos].sort(
        (a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin,
      );
      await tx.unidade.update({
        where: { id },
        data: {
          horarioFuncionamento: turnos as unknown as Prisma.InputJsonValue,
          // Os dias de trabalho seguem o horário (uma fonte só); sem horário, ficam como estavam.
          ...(turnos.length ? { diasTrabalho: diasQueAbre(turnos) } : {}),
        },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'funcionamento',
        antes: { turnos: lerFuncionamento(u.horarioFuncionamento) },
        depois: { turnos },
      });
      return { turnos };
    });
  }

  @Get(':id/agendamento-visual')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Visual da página de agendamento (cor, logotipo, capa, boas-vindas)' })
  visualAgendamento(@Param('id', ParseUUIDPipe) id: string): Promise<VisualAgendamento> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await tx.unidade.findUnique({ where: { id } });
      if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
      return (
        lerVisualAgendamento(u.agendamentoVisual) ??
        visualAgendamentoInicial(lerSiteOuNulo(u.sitePublicado) ?? lerSiteOuNulo(u.siteRascunho))
      );
    });
  }

  @Put(':id/agendamento-visual')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Gravar o visual da página de agendamento (vale na hora)' })
  gravarVisualAgendamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(visualAgendamentoSchema) visual: VisualAgendamento,
  ): Promise<VisualAgendamento> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await tx.unidade.findUnique({ where: { id } });
      if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
      const fotos = fotosDoVisual(visual);
      if (
        fotos.length &&
        (await tx.fotoSite.count({ where: { id: { in: fotos } } })) !== new Set(fotos).size
      )
        throw Erros.requisicaoInvalida(
          'foto_invalida',
          'Uma das fotos não existe mais. Envie de novo.',
        );
      await tx.unidade.update({
        where: { id },
        data: { agendamentoVisual: visual as unknown as Prisma.InputJsonValue },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'agendamento_visual',
        antes: null,
        depois: { ativo: visual.ativo, cor: visual.cor },
      });
      return visual;
    });
  }

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
    return { u, rascunho: lerSite(u.siteRascunho, conta.nome), barbearia: conta.nome };
  }

  private async painelDoSite(
    u: {
      slug: string | null;
      agendamentoPublico: boolean;
      sitePublicado: unknown;
      sitePublicadoEm: Date | null;
      siteSlug: string | null;
      dominio: string | null;
      dominioVerificadoEm: Date | null;
    },
    rascunho: SiteBarbearia,
    barbearia: string,
  ): Promise<SitePainel> {
    return {
      rascunho,
      publicado: u.sitePublicado !== null,
      publicadoEm: u.sitePublicadoEm?.toISOString() ?? null,
      alteracoesPendentes:
        u.sitePublicado === null || !isDeepStrictEqual(u.sitePublicado, rascunho),
      slug: u.slug,
      linkLigado: u.agendamentoPublico,
      siteSlug: u.siteSlug,
      sugestaoSiteSlug: sugestaoDeSiteSlug(u.slug, barbearia),
      dominio: u.dominio,
      dominioVerificado: u.dominioVerificadoEm !== null,
      // Só para quem ainda precisa apontar o DNS (é uma consulta de DNS).
      dominioIps: u.dominio && !u.dominioVerificadoEm ? await ipsDoServidor(this.config) : [],
    };
  }

  @Put(':id/site/dominio')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({
    summary: 'Domínio próprio do site (lote 7e): grava e já confere o DNS',
  })
  definirDominio(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(dominioSchema) { dominio }: DominioEntrada,
  ): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    const alvo = this.config.dominio.alvo;
    if (dominio === alvo || dominio.endsWith(`.${alvo}`))
      throw Erros.requisicaoInvalida(
        'dominio_invalido',
        'Use o domínio da barbearia, não o do Pente Fino.',
      );
    return this.banco.daConta(async (tx) => {
      const { u, rascunho, barbearia } = await this.unidadeDoSite(tx, id);
      if (await dominioEmUso(tx, dominio, id))
        throw Erros.conflito('Esse domínio já está cadastrado em outra barbearia.');
      const apontado = await dominioApontado(this.config, dominio);
      const salvo = await tx.unidade.update({
        where: { id },
        data: {
          dominio,
          dominioVerificadoEm:
            dominio === u.dominio && u.dominioVerificadoEm
              ? u.dominioVerificadoEm
              : apontado
                ? new Date()
                : null,
        },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'site_dominio',
        antes: { dominio: u.dominio },
        depois: { dominio },
      });
      return this.painelDoSite(salvo, rascunho, barbearia);
    });
  }

  @Post(':id/site/dominio/verificar')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conferir de novo o DNS do domínio próprio' })
  verificarDominio(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho, barbearia } = await this.unidadeDoSite(tx, id);
      if (!u.dominio) return this.painelDoSite(u, rascunho, barbearia);
      const apontado = await dominioApontado(this.config, u.dominio);
      const salvo = await tx.unidade.update({
        where: { id },
        data: { dominioVerificadoEm: apontado ? (u.dominioVerificadoEm ?? new Date()) : null },
      });
      return this.painelDoSite(salvo, rascunho, barbearia);
    });
  }

  @Delete(':id/site/dominio')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({ summary: 'Tirar o domínio próprio (o site segue no endereço do Pente Fino)' })
  tirarDominio(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho, barbearia } = await this.unidadeDoSite(tx, id);
      const salvo = await tx.unidade.update({
        where: { id },
        data: { dominio: null, dominioVerificadoEm: null },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'site_dominio',
        antes: { dominio: u.dominio },
        depois: { dominio: null },
      });
      return this.painelDoSite(salvo, rascunho, barbearia);
    });
  }

  @Get(':id/site')
  @Papeis(...GESTAO)
  @ApiOperation({ summary: 'Site da unidade para editar: rascunho (ou o sugerido) e situação' })
  site(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho, barbearia } = await this.unidadeDoSite(tx, id);
      return this.painelDoSite(u, rascunho, barbearia);
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
      const { u, barbearia } = await this.unidadeDoSite(tx, id);
      // Só foto enviada por esta conta (a tabela é isolada por conta).
      const fotos = fotosDoSite(site);
      if (fotos.length) {
        const achadas = await tx.fotoSite.count({ where: { id: { in: fotos } } });
        if (achadas !== fotos.length)
          throw Erros.requisicaoInvalida(
            'foto_invalida',
            'Uma das fotos não existe mais. Envie de novo.',
          );
      }
      const salvo = await tx.unidade.update({
        where: { id },
        data: { siteRascunho: site as unknown as Prisma.InputJsonValue },
      });
      return this.painelDoSite({ ...u, ...salvo }, site, barbearia);
    });
  }

  @Post(':id/site/fotos')
  @Papeis(...GESTAO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enviar foto do site (reduzida no navegador; refeita aqui sem os dados da câmera)',
  })
  async enviarFoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(envioFotoSchema) envio: EnvioFoto,
  ): Promise<FotoEnviada> {
    exigirUnidade(id, GESTAO);
    const foto = await processarFoto(envio.dados);
    return this.banco.daConta(async (tx) => {
      await this.unidadeDoSite(tx, id);
      if ((await tx.fotoSite.count({ where: { unidadeId: id } })) >= LIMITE_FOTOS_UNIDADE)
        throw Erros.requisicaoInvalida(
          'limite_fotos',
          `Esta unidade já tem ${LIMITE_FOTOS_UNIDADE} fotos enviadas.`,
        );
      const linha = await tx.fotoSite.create({
        data: { unidadeId: id, largura: foto.largura, altura: foto.altura, bytes: foto.bytes },
      });
      await gravarFoto(this.config.fotosDir, linha.id, foto);
      return { id: linha.id, largura: foto.largura, altura: foto.altura };
    });
  }

  @Put(':id/site/endereco')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({
    summary: 'Trocar o endereço do site (/s/<slug>); o antigo passa a levar ao novo',
  })
  trocarEnderecoDoSite(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(enderecoSiteSchema) { slug }: EnderecoSite,
  ): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho, barbearia } = await this.unidadeDoSite(tx, id);
      if (u.siteSlug === slug) return this.painelDoSite(u, rascunho, barbearia);
      if (await siteSlugEmUso(tx, slug, id))
        throw Erros.conflito('Esse endereço já é de outra barbearia. Escolha outro.');
      const salvo = await tx.unidade.update({ where: { id }, data: { siteSlug: slug } });
      await registrarTrocaDeEndereco(tx, id, 'site', u.siteSlug, slug);
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: id,
        acao: 'site_endereco',
        antes: { siteSlug: u.siteSlug },
        depois: { siteSlug: slug },
      });
      return this.painelDoSite(salvo, rascunho, barbearia);
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
  @ApiOperation({
    summary:
      'Publicar o rascunho no endereço do site (/s/<site_slug>); sem endereço, usa a sugestão',
  })
  publicarSite(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { u, rascunho, barbearia } = await this.unidadeDoSite(tx, id);
      // O site não depende do link de agendamento (decisão do dono, 13/11): sem link ligado, os
      // botões "Agendar" dão lugar ao WhatsApp da unidade.
      const siteSlug =
        u.siteSlug ?? (await siteSlugLivre(tx, sugestaoDeSiteSlug(u.slug, barbearia), id));
      const salvo = await tx.unidade.update({
        where: { id },
        data: {
          siteSlug,
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
      return this.painelDoSite(salvo, rascunho, barbearia);
    });
  }

  @Delete(':id/site/publicado')
  @Papeis(...GESTAO)
  @Auditada()
  @ApiOperation({
    summary: 'Tirar o site do ar (o rascunho e o endereço ficam guardados)',
  })
  despublicarSite(@Param('id', ParseUUIDPipe) id: string): Promise<SitePainel> {
    exigirUnidade(id, GESTAO);
    return this.banco.daConta(async (tx) => {
      const { rascunho, barbearia } = await this.unidadeDoSite(tx, id);
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
      return this.painelDoSite(salvo, rascunho, barbearia);
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
      // Link trocado (lote 7d): o antigo continua levando ao novo; o site não muda.
      if (dados.slug !== undefined)
        await registrarTrocaDeEndereco(tx, unidadeId, 'agendamento', antes.slug, depois.slug);
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

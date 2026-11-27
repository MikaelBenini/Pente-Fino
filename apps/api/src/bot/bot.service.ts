import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  contextoDaConversa,
  fluxoAnuncioDaUnidade,
  podeAgendarPelaConversa,
  responderComAgenda,
  instanciaDaUnidade,
  json,
  lerMenu,
  mensagensDoBot,
  menuPublicado,
  numerosDasAutomacoes,
  Prisma,
  protecaoDoNumero,
  registrarEstadoConexao,
  servicosParaAgendar,
  situacaoDaUnidade,
  unidadeDoBot,
  type Transacao,
} from '@pente-fino/db';
import {
  dataLocal,
  lerAutomacoes,
  lerFluxoAnuncio,
  type FluxoAnuncio,
  type FluxoAnuncioDoEscopo,
  type FluxoAnuncioEntrada,
  lerRegrasAgendamento,
  TIPOS_MENSAGEM_BOT,
  validarMenu,
  type AvisoDoBot,
  type TipoMensagemBot,
  type AutomacoesConta,
  type EstadoAutomacoes,
  type ConexaoBot,
  type EstadoBot,
  type HorarioBotEntrada,
  type MensagensBot,
  type MensagensBotEntrada,
  type MenuBot,
  type DiagnosticoSimulacao,
  type RespostaSimulacao,
  type SimularBotDados,
} from '@pente-fino/shared';
import type { EstadoConexao, ProvedorWhatsApp } from '@pente-fino/whatsapp';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { AlertaConexaoService } from '../whatsapp/alerta-conexao.service.js';
import { Erros } from '../comum/erros.js';
import { exigirUnidade, filtroUnidade, GESTAO } from '../comum/escopo.js';
import { umPorVez } from '../comum/sequencia.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { PROVEDOR_WHATSAPP } from '../whatsapp/provedor.js';

@Injectable()
export class BotService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(PROVEDOR_WHATSAPP) private readonly provedor: ProvedorWhatsApp,
    @Inject(AlertaConexaoService) private readonly alerta: AlertaConexaoService,
  ) {}

  private readonly logger = new Logger('Bot');

  /** Menu e mensagens valem para a conta inteira: só o dono edita. */
  private podeEditar() {
    return Contexto.usuario().papeis.some((p) => p.papel === 'dono');
  }

  private exigirDono() {
    if (!this.podeEditar()) throw Erros.semPermissao();
  }

  private async unidade(tx: Transacao, unidadeId: string) {
    const u = await unidadeDoBot(tx, unidadeId);
    if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
    return u;
  }

  /** Unidade do escopo (nulo = padrão da barbearia), conferida e com o nome. */
  private async escopo(tx: Transacao, unidadeId: string | null) {
    if (!unidadeId) return { unidadeId: null, nome: 'Padrão da conta' };
    exigirUnidade(unidadeId, GESTAO);
    const u = await this.unidade(tx, unidadeId);
    return { unidadeId: u.id, nome: u.nome };
  }

  /** O publicado exatamente deste escopo (sem cair no padrão). */
  private publicadoDoEscopo(tx: Transacao, unidadeId: string | null) {
    return unidadeId
      ? tx.botMenu.findFirst({ where: { status: 'publicado', unidadeId } })
      : menuPublicado(tx);
  }

  async estado(unidadeId: string | null = null): Promise<EstadoBot> {
    return this.banco.daConta(async (tx) => {
      const escopo = await this.escopo(tx, unidadeId);
      const publicado = await menuPublicado(tx, unidadeId);
      const rascunho = await tx.botMenu.findFirst({ where: { status: 'rascunho', unidadeId } });
      const anterior = await tx.botMenu.count({ where: { status: 'arquivado', unidadeId } });
      const menuProprio =
        !unidadeId ||
        (await tx.botMenu.count({
          where: { unidadeId, status: { in: ['publicado', 'rascunho'] } },
        })) > 0;
      const mensagensProprias = unidadeId
        ? (
            await tx.modeloMensagem.findMany({
              where: { unidadeId, ativo: true, tipo: { in: [...TIPOS_MENSAGEM_BOT] } },
              select: { tipo: true },
            })
          ).map((m) => m.tipo as TipoMensagemBot)
        : [];
      const quem = publicado.publicadoPorId
        ? await tx.usuario.findUnique({
            where: { id: publicado.publicadoPorId },
            select: { nome: true },
          })
        : null;
      const unidades = await tx.unidade.findMany({
        where: { ativa: true, ...filtroUnidade(GESTAO, 'id') },
        include: { profissionais: { include: { horarios: true } }, botConexao: true },
        orderBy: { nome: 'asc' },
      });
      const agora = new Date();
      const hoje = dataLocal(agora);
      const menuRascunho = rascunho ? lerMenu(rascunho.menu) : null;
      const avisos: AvisoDoBot[] = [];
      const situacoes = await umPorVez(unidades, async (u) => {
        const s = await situacaoDaUnidade(tx, u, agora, this.config.appUrl);
        // Lista do dono (16/11): o que faz o bot falhar em cada unidade, antes de publicar.
        const aviso = (mensagem: string) =>
          avisos.push({ unidadeId: u.id, unidade: u.nome, mensagem });
        if (u.botConexao?.status !== 'conectado')
          aviso('Sem número de WhatsApp conectado: o bot não recebe nem responde nada.');
        if ((await servicosParaAgendar(tx, u.id, hoje)).length === 0)
          aviso('Nenhum serviço com preço nesta unidade: o bot não consegue marcar horário.');
        if (!s.link)
          aviso(
            'Sem link de agendamento: quando o bot não conseguir marcar, não há outro caminho para o cliente.',
          );
        return { u, s, protecao: await protecaoDoNumero(tx, u.id, agora) };
      });
      return {
        publicado: {
          menu: lerMenu(publicado.menu),
          publicadoEm: publicado.publicadoEm?.toISOString() ?? null,
          publicadoPor: quem?.nome ?? null,
        },
        rascunho:
          rascunho && menuRascunho
            ? {
                menu: menuRascunho,
                atualizadoEm: rascunho.atualizadoEm.toISOString(),
                problemas: validarMenu(menuRascunho),
              }
            : null,
        temAnterior: anterior > 0,
        mensagens: await mensagensDoBot(tx, unidadeId),
        pesquisaAtiva:
          (await tx.conta.findFirst({ select: { pesquisaPosAtendimento: true } }))
            ?.pesquisaPosAtendimento ?? false,
        unidades: situacoes.map(({ u, s, protecao }) => ({
          id: u.id,
          nome: u.nome,
          horario: s.horario,
          expediente: s.expediente,
          descricao: s.descricao,
          aberto: s.aberto,
          link: s.link,
          linkGoogle: u.linkAvaliacaoGoogle,
          conexao: u.botConexao
            ? {
                status: u.botConexao.status,
                numero: u.botConexao.numero,
                caiuEm: u.botConexao.caiuEm?.toISOString() ?? null,
                protecao,
              }
            : null,
        })),
        podeEditar: this.podeEditar(),
        escopo: { ...escopo, menuProprio, mensagensProprias },
        avisos: unidadeId ? avisos.filter((a) => a.unidadeId === unidadeId) : avisos,
      };
    });
  }

  async salvarRascunho(menu: MenuBot, unidadeId: string | null = null) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      await this.escopo(tx, unidadeId);
      const atual = await tx.botMenu.findFirst({ where: { status: 'rascunho', unidadeId } });
      if (atual) await tx.botMenu.update({ where: { id: atual.id }, data: { menu: json(menu) } });
      else await tx.botMenu.create({ data: { status: 'rascunho', menu: json(menu), unidadeId } });
      return { problemas: validarMenu(menu) };
    });
  }

  async descartarRascunho(unidadeId: string | null = null) {
    this.exigirDono();
    await this.banco.daConta((tx) =>
      tx.botMenu.deleteMany({ where: { status: 'rascunho', unidadeId } }),
    );
  }

  /** Rascunho vira o menu do bot; o que estava publicado fica guardado para voltar. */
  async publicar(unidadeId: string | null = null) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      await this.escopo(tx, unidadeId);
      const rascunho = await tx.botMenu.findFirst({ where: { status: 'rascunho', unidadeId } });
      if (!rascunho)
        throw Erros.requisicaoInvalida('sem_rascunho', 'Não há alterações para publicar.');
      const menu = lerMenu(rascunho.menu);
      const problemas = validarMenu(menu);
      if (problemas.length)
        throw Erros.validacao(problemas.map((p) => ({ campo: p.onde, mensagem: p.mensagem })));
      const antes = await this.publicadoDoEscopo(tx, unidadeId);
      if (antes)
        await tx.botMenu.update({ where: { id: antes.id }, data: { status: 'arquivado' } });
      await tx.botMenu.update({
        where: { id: rascunho.id },
        data: {
          status: 'publicado',
          publicadoEm: new Date(),
          publicadoPorId: Contexto.usuario().id,
        },
      });
      await auditar(tx, {
        entidade: 'bot_menu',
        entidadeId: rascunho.id,
        acao: 'publicar',
        antes: { versao: antes?.id ?? null, unidadeId },
        depois: { versao: rascunho.id, unidadeId },
      });
    });
  }

  /** Volta à última versão publicada antes desta (no mesmo escopo). */
  async restaurarAnterior(unidadeId: string | null = null) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      await this.escopo(tx, unidadeId);
      const anterior = await tx.botMenu.findFirst({
        where: { status: 'arquivado', unidadeId },
        orderBy: { publicadoEm: 'desc' },
      });
      if (!anterior)
        throw Erros.requisicaoInvalida('sem_anterior', 'Não há versão anterior para voltar.');
      const atual = await this.publicadoDoEscopo(tx, unidadeId);
      if (atual)
        await tx.botMenu.update({ where: { id: atual.id }, data: { status: 'arquivado' } });
      await tx.botMenu.update({
        where: { id: anterior.id },
        data: {
          status: 'publicado',
          publicadoEm: new Date(),
          publicadoPorId: Contexto.usuario().id,
        },
      });
      await auditar(tx, {
        entidade: 'bot_menu',
        entidadeId: anterior.id,
        acao: 'restaurar',
        antes: { versao: atual?.id ?? null, unidadeId },
        depois: { versao: anterior.id, unidadeId },
      });
    });
  }

  /**
   * Mensagens prontas do escopo. Na unidade, só ficam gravadas as que diferem do padrão da
   * barbearia; a igual ao padrão volta a seguir o padrão.
   */
  async salvarMensagens(d: MensagensBotEntrada, unidadeId: string | null = null) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      await this.escopo(tx, unidadeId);
      const padrao = unidadeId ? await mensagensDoBot(tx) : null;
      for (const [tipo, texto] of Object.entries(d.mensagens)) {
        const t = tipo as keyof MensagensBot;
        const atual = await tx.modeloMensagem.findFirst({ where: { unidadeId, tipo: t } });
        if (padrao && texto === padrao[t]) {
          if (atual) await tx.modeloMensagem.delete({ where: { id: atual.id } });
          continue;
        }
        if (atual)
          await tx.modeloMensagem.update({ where: { id: atual.id }, data: { texto, ativo: true } });
        else await tx.modeloMensagem.create({ data: { tipo: t, texto: texto!, unidadeId } });
      }
      return mensagensDoBot(tx, unidadeId);
    });
  }

  /** Mensagens automáticas de quem vem de anúncio (pedido do dono em 16/11/2026). */
  /** Com a unidade: as dela (próprias) ou as da conta (padrão). Sugestão aprovada em 16/11. */
  async fluxoAnuncio(unidadeId: string | null = null): Promise<FluxoAnuncioDoEscopo> {
    return this.banco.daConta(async (tx) => {
      if (unidadeId) {
        await this.escopo(tx, unidadeId);
        const u = await tx.unidade.findUniqueOrThrow({
          where: { id: unidadeId },
          select: { fluxoAnuncio: true },
        });
        return { ...(await fluxoAnuncioDaUnidade(tx, u)), proprio: u.fluxoAnuncio !== null };
      }
      return {
        ...lerFluxoAnuncio(
          (await tx.conta.findFirst({ select: { fluxoAnuncio: true } }))?.fluxoAnuncio,
        ),
        proprio: true,
      };
    });
  }

  async salvarFluxoAnuncio(
    d: FluxoAnuncioEntrada,
    unidadeId: string | null = null,
  ): Promise<FluxoAnuncio> {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      if (unidadeId) {
        await this.escopo(tx, unidadeId);
        await tx.unidade.update({
          where: { id: unidadeId },
          data: { fluxoAnuncio: d as unknown as Prisma.InputJsonValue },
        });
        await auditar(tx, {
          entidade: 'unidade',
          entidadeId: unidadeId,
          acao: 'fluxo_anuncio',
          depois: d,
        });
        return lerFluxoAnuncio(d);
      }
      const conta = await tx.conta.findFirstOrThrow({ select: { id: true, fluxoAnuncio: true } });
      await tx.conta.update({
        where: { id: conta.id },
        data: { fluxoAnuncio: d as unknown as Prisma.InputJsonValue },
      });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: conta.id,
        acao: 'fluxo_anuncio',
        antes: conta.fluxoAnuncio,
        depois: d,
      });
      return lerFluxoAnuncio(d);
    });
  }

  /** A unidade volta a usar as mensagens de anúncio da conta. */
  async anuncioDoPadrao(unidadeId: string) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      await this.escopo(tx, unidadeId);
      await tx.unidade.update({ where: { id: unidadeId }, data: { fluxoAnuncio: Prisma.DbNull } });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: unidadeId,
        acao: 'fluxo_anuncio_padrao',
      });
    });
  }

  /** A unidade volta a usar o menu e as mensagens do padrão da barbearia. */
  async usarPadrao(unidadeId: string) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      await this.escopo(tx, unidadeId);
      const menus = await tx.botMenu.deleteMany({ where: { unidadeId } });
      const mensagens = await tx.modeloMensagem.deleteMany({
        where: { unidadeId, tipo: { in: [...TIPOS_MENSAGEM_BOT] } },
      });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: unidadeId,
        acao: 'bot_usar_padrao',
        depois: { menus: menus.count, mensagens: mensagens.count },
      });
    });
  }

  /** Liga ou desliga a pesquisa depois do atendimento (só o dono). */
  async salvarPesquisa(ativa: boolean): Promise<{ ativa: boolean }> {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findFirstOrThrow();
      await tx.conta.update({ where: { id: conta.id }, data: { pesquisaPosAtendimento: ativa } });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: conta.id,
        acao: ativa ? 'ligar_pesquisa' : 'desligar_pesquisa',
        antes: { pesquisaPosAtendimento: conta.pesquisaPosAtendimento },
        depois: { pesquisaPosAtendimento: ativa },
      });
      return { ativa };
    });
  }

  /** Automações (retorno e aniversário) e os números de cada uma no período (mês por padrão). */
  async automacoes(de: string, ate: string): Promise<EstadoAutomacoes> {
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findFirstOrThrow({ select: { automacoes: true } });
      return {
        config: lerAutomacoes(conta.automacoes),
        numeros: await numerosDasAutomacoes(
          tx,
          filtroUnidade(GESTAO),
          new Date(`${de}T00:00:00-03:00`),
          new Date(new Date(`${ate}T00:00:00-03:00`).getTime() + 86_400_000),
        ),
      };
    });
  }

  /** Liga e desliga as automações da conta (só o dono). */
  async salvarAutomacoes(d: AutomacoesConta): Promise<AutomacoesConta> {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      const conta = await tx.conta.findFirstOrThrow();
      await tx.conta.update({
        where: { id: conta.id },
        data: { automacoes: d as unknown as Prisma.InputJsonValue },
      });
      await auditar(tx, {
        entidade: 'conta',
        entidadeId: conta.id,
        acao: 'automacoes',
        antes: { automacoes: lerAutomacoes(conta.automacoes) },
        depois: { automacoes: d },
      });
      return d;
    });
  }

  /** Link do Google da unidade: convite depois da nota 5 (null desliga). */
  async salvarLinkGoogle(unidadeId: string, link: string | null): Promise<void> {
    exigirUnidade(unidadeId, GESTAO);
    await this.banco.daConta(async (tx) => {
      const u = await this.unidade(tx, unidadeId);
      await tx.unidade.update({ where: { id: unidadeId }, data: { linkAvaliacaoGoogle: link } });
      await auditar(tx, {
        entidade: 'unidade',
        entidadeId: unidadeId,
        acao: 'link_google',
        antes: { linkAvaliacaoGoogle: u.linkAvaliacaoGoogle },
        depois: { linkAvaliacaoGoogle: link },
      });
    });
  }

  async salvarHorario(unidadeId: string, d: HorarioBotEntrada) {
    exigirUnidade(unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      await this.unidade(tx, unidadeId);
      await tx.unidade.update({
        where: { id: unidadeId },
        data: {
          botHorario:
            d.turnos === null ? Prisma.DbNull : (d.turnos as unknown as Prisma.InputJsonValue),
        },
      });
    });
  }

  /** Conversa de teste no painel: mesmo motor, mesma unidade, sem mandar nada a ninguém. */
  async simular(d: SimularBotDados): Promise<RespostaSimulacao> {
    exigirUnidade(d.unidadeId, GESTAO);
    return this.banco.daConta(async (tx) => {
      const u = await this.unidade(tx, d.unidadeId);
      // O rascunho da unidade; sem menu próprio, o rascunho do padrão da barbearia.
      const menuProprio =
        (await tx.botMenu.count({
          where: { unidadeId: u.id, status: { in: ['publicado', 'rascunho'] } },
        })) > 0;
      const rascunho =
        d.versao === 'rascunho'
          ? await tx.botMenu.findFirst({
              where: { status: 'rascunho', unidadeId: menuProprio ? u.id : null },
            })
          : null;
      const linha = rascunho ?? (await menuPublicado(tx, u.id));
      const menu = lerMenu(linha.menu);
      // Lista do dono (16/11): o simulador diz de onde veio o menu e por que não há opções.
      const aviso =
        d.versao === 'rascunho' && !rascunho
          ? 'Não há rascunho: este teste usou o menu publicado.'
          : menu.menu.opcoes.length === 0
            ? 'Este menu está sem opções: o cliente só vê o texto e nenhum número funciona. Acrescente opções antes de publicar.'
            : null;
      const diagnostico: DiagnosticoSimulacao = {
        versao: rascunho ? 'rascunho' : 'publicado',
        deQuem: linha.unidadeId ? 'unidade' : 'padrao',
        opcoes: menu.menu.opcoes.map((o) => o.rotulo),
        aviso,
      };
      const agora = new Date();
      const ctx = await contextoDaConversa(tx, u, agora, this.config.appUrl, {
        cliente: d.cliente,
        // Número novo: a primeira conversa termina com o convite para receber avisos.
        pedirConsentimento: d.cliente === null,
        agendarPelaConversa: await podeAgendarPelaConversa(tx, u.id, dataLocal(agora)),
      });
      if (d.foraDoHorario) ctx.dentroDoHorario = false;
      // O mesmo passo a passo do WhatsApp, sem gravar o agendamento no fim.
      const r = await responderComAgenda(tx, {
        anuncio: {
          fluxo: await fluxoAnuncioDaUnidade(tx, u),
          chegada: d.doAnuncio,
        },
        menu,
        mensagens: await mensagensDoBot(tx, u.id),
        sessao: d.sessao,
        entrada: d.entrada,
        ctx,
        dados: {
          unidadeId: u.id,
          clienteId: '',
          barbearia: ctx.barbearia,
          link: ctx.link,
          agora,
          simulacao: true,
          regras: lerRegrasAgendamento(u.regrasAgendamento),
        },
      });
      return { ...r, diagnostico };
    });
  }

  // ─── Conexão do WhatsApp ────────────────────────────────────────────────

  private async linhaConexao(unidadeId: string) {
    return this.banco.daConta(async (tx) => {
      await this.unidade(tx, unidadeId);
      return tx.botConexao.findUnique({ where: { unidadeId } });
    });
  }

  private resposta(
    unidadeId: string,
    linha: { status: ConexaoBot['status']; numero: string | null; caiuEm: Date | null } | null,
    extra: { qr?: string | null; erro?: string | null } = {},
  ): ConexaoBot {
    return {
      unidadeId,
      status: linha?.status ?? 'desconectado',
      numero: linha?.numero ?? null,
      qr: linha?.status === 'aguardando_qr' ? (extra.qr ?? null) : null,
      caiuEm: linha?.caiuEm?.toISOString() ?? null,
      erro: extra.erro ?? null,
      teste: this.provedor.nome === 'falso',
    };
  }

  /** Grava o que o provedor disse e devolve como a tela mostra. */
  private async gravar(unidadeId: string, e: EstadoConexao): Promise<ConexaoBot> {
    const agora = new Date();
    const linha = await this.banco.daConta((tx) => registrarEstadoConexao(tx, unidadeId, e, agora));
    // A consulta da tela também descobre a queda (se o webhook não chegou).
    if (this.alerta.caiuAgora(linha, agora))
      await this.alerta.avisar(Contexto.usuario().contaId, unidadeId, agora);
    return this.resposta(unidadeId, linha, { qr: e.qr });
  }

  private falha(unidadeId: string, linha: Parameters<BotService['resposta']>[1], e: unknown) {
    this.logger.warn(`WhatsApp da unidade ${unidadeId}: ${(e as Error).message}`);
    return this.resposta(unidadeId, linha, {
      erro: 'O serviço do WhatsApp não respondeu. Tente de novo em instantes.',
    });
  }

  /** Estado atual (pergunta ao provedor) e o QR enquanto aguarda a leitura. */
  async conexao(unidadeId: string): Promise<ConexaoBot> {
    exigirUnidade(unidadeId, GESTAO);
    const linha = await this.linhaConexao(unidadeId);
    if (!linha) return this.resposta(unidadeId, null);
    let r: ConexaoBot;
    try {
      r = await this.gravar(unidadeId, await this.provedor.estado(linha.instancia));
    } catch (e) {
      r = this.falha(unidadeId, linha, e);
    }
    // Proteção do número contra restrição: o que já saiu hoje, o limite e a pausa (27/11/2026).
    return {
      ...r,
      protecao: await this.banco.daConta((tx) => protecaoDoNumero(tx, unidadeId)),
    };
  }

  /** Cria a instância da unidade (uma por unidade), aponta o webhook e devolve o QR. */
  async conectar(unidadeId: string): Promise<ConexaoBot> {
    exigirUnidade(unidadeId, GESTAO);
    const existente = await this.linhaConexao(unidadeId);
    const linha = await this.banco.daConta(async (tx) => {
      if (!existente)
        return tx.botConexao.create({
          data: {
            unidadeId,
            instancia: instanciaDaUnidade(unidadeId),
            provedor: this.provedor.nome,
          },
        });
      if (existente.provedor === this.provedor.nome) return existente;
      return tx.botConexao.update({ where: { unidadeId }, data: { provedor: this.provedor.nome } });
    });
    try {
      const e = await this.provedor.conectar(linha.instancia, this.config.whatsapp.webhookUrl);
      return await this.gravar(unidadeId, e);
    } catch (e) {
      return this.falha(unidadeId, linha, e);
    }
  }

  /**
   * Retoma as automáticas pausadas pela proteção do número: o dono resolveu a causa (chip novo,
   * celular com internet). Fica na auditoria com o motivo e a pausa que havia.
   */
  async retomarAutomaticas(unidadeId: string, motivo: string): Promise<ConexaoBot> {
    exigirUnidade(unidadeId, GESTAO);
    const linha = await this.linhaConexao(unidadeId);
    if (!linha) throw Erros.naoEncontrado('Esta unidade ainda não conectou o WhatsApp.');
    if (!linha.pausadoAte || linha.pausadoAte <= new Date())
      throw Erros.conflito('As mensagens automáticas deste número não estão pausadas.');
    await this.banco.daConta(async (tx) => {
      await tx.botConexao.update({
        where: { unidadeId },
        data: { pausadoAte: null, pausaMotivo: null, retomadoEm: new Date() },
      });
      await auditar(tx, {
        entidade: 'bot_conexao',
        entidadeId: linha.id,
        acao: 'retomar_automaticas',
        antes: { pausadoAte: linha.pausadoAte, pausaMotivo: linha.pausaMotivo },
        depois: { pausadoAte: null, motivo },
      });
    });
    return this.conexao(unidadeId);
  }

  /** Desliga o número. Gravado antes, para o aviso de "caiu" não aparecer. */
  async desconectar(unidadeId: string): Promise<ConexaoBot> {
    exigirUnidade(unidadeId, GESTAO);
    const linha = await this.linhaConexao(unidadeId);
    if (!linha) throw Erros.naoEncontrado('Esta unidade ainda não conectou o WhatsApp.');
    const atualizada = await this.banco.daConta(async (tx) => {
      const r = await tx.botConexao.update({
        where: { unidadeId },
        data: { status: 'desconectado', caiuEm: null, numero: null },
      });
      await auditar(tx, {
        entidade: 'bot_conexao',
        entidadeId: linha.id,
        acao: 'desconectar',
        antes: { status: linha.status, numero: linha.numero },
        depois: { status: 'desconectado' },
      });
      return r;
    });
    try {
      await this.provedor.desconectar(linha.instancia);
      return this.resposta(unidadeId, atualizada);
    } catch (e) {
      return this.falha(unidadeId, atualizada, e);
    }
  }
}

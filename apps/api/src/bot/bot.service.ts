import { Inject, Injectable } from '@nestjs/common';
import { precoServicoVigente, Prisma, type Transacao } from '@pente-fino/db';
import {
  dataLocal,
  dentroDoHorario,
  descreverHorario,
  MENSAGENS_BOT_PADRAO,
  MENU_BOT_PADRAO,
  menuBotSchema,
  responder,
  TIPOS_MENSAGEM_BOT,
  validarMenu,
  type ContextoConversa,
  type EstadoBot,
  type HorarioBotEntrada,
  type MensagensBot,
  type MensagensBotEntrada,
  type MenuBot,
  type RespostaSimulacao,
  type SimularBotDados,
  type TurnoBot,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { data, exigirUnidade, filtroUnidade, GESTAO } from '../comum/escopo.js';
import { umPorVez } from '../comum/sequencia.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

const json = (m: MenuBot) => structuredClone(m) as unknown as Prisma.InputJsonValue;
/** O que está gravado no banco passa de novo pelo esquema: menu estragado não chega ao motor. */
const lerMenu = (valor: unknown): MenuBot => {
  const r = menuBotSchema.safeParse(valor);
  return r.success ? r.data : structuredClone(MENU_BOT_PADRAO);
};

type UnidadeComEquipe = Prisma.UnidadeGetPayload<{
  include: { profissionais: { include: { horarios: true } }; botConexao: true };
}>;

/** Expediente da equipe: nos dias da unidade, do primeiro turno que abre ao último que fecha. */
export function expedienteDaUnidade(u: UnidadeComEquipe): TurnoBot[] {
  const turnos: TurnoBot[] = [];
  for (const dia of u.diasTrabalho) {
    const doDia = u.profissionais
      .filter((p) => p.ativo)
      .flatMap((p) => p.horarios.filter((h) => h.diaSemana === dia));
    if (doDia.length === 0) continue;
    turnos.push({
      diaSemana: dia,
      inicioMin: Math.min(...doDia.map((h) => h.inicioMin)),
      fimMin: Math.max(...doDia.map((h) => h.fimMin)),
    });
  }
  return turnos;
}

@Injectable()
export class BotService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  /** Menu e mensagens valem para a conta inteira: só o dono edita. */
  private podeEditar() {
    return Contexto.usuario().papeis.some((p) => p.papel === 'dono');
  }

  private exigirDono() {
    if (!this.podeEditar()) throw Erros.semPermissao();
  }

  /** Menu publicado; conta antiga sem menu recebe o padrão publicado na hora. */
  private async publicado(tx: Transacao) {
    const atual = await tx.botMenu.findFirst({ where: { status: 'publicado' } });
    if (atual) return atual;
    return tx.botMenu.create({
      data: { status: 'publicado', menu: json(MENU_BOT_PADRAO), publicadoEm: new Date() },
    });
  }

  private async mensagens(tx: Transacao): Promise<MensagensBot> {
    const salvas = await tx.modeloMensagem.findMany({
      where: { unidadeId: null, ativo: true, tipo: { in: [...TIPOS_MENSAGEM_BOT] } },
    });
    const m: MensagensBot = { ...MENSAGENS_BOT_PADRAO };
    for (const s of salvas) m[s.tipo as keyof MensagensBot] = s.texto;
    return m;
  }

  private async unidade(tx: Transacao, unidadeId: string) {
    const u = await tx.unidade.findUnique({
      where: { id: unidadeId },
      include: { profissionais: { include: { horarios: true } }, botConexao: true },
    });
    if (!u) throw Erros.naoEncontrado('Unidade não encontrada.');
    return u;
  }

  /** Horário que vale, se está aberto agora (calendário incluído) e o link de agendamento. */
  private async situacao(tx: Transacao, u: UnidadeComEquipe, agora: Date) {
    const expediente = expedienteDaUnidade(u);
    const horario = (u.botHorario as TurnoBot[] | null) ?? null;
    const vale = horario ?? expediente;
    const fechadoHoje = await tx.calendarioUnidade.findFirst({
      where: { unidadeId: u.id, data: data(dataLocal(agora)), trabalha: false },
    });
    return {
      expediente,
      horario,
      descricao: descreverHorario(vale),
      // Sem horário conhecido (equipe sem expediente cadastrado), não diz que está fechado.
      aberto: !fechadoHoje && (vale.length === 0 || dentroDoHorario(vale, agora)),
      link:
        u.agendamentoPublico && u.slug
          ? `${this.config.appUrl}/agendar?u=${encodeURIComponent(u.slug)}`
          : null,
    };
  }

  /** O que o motor precisa saber da unidade para responder (usado também pelo WhatsApp). */
  async contexto(
    tx: Transacao,
    unidadeId: string,
    agora: Date,
    cliente: string | null,
  ): Promise<ContextoConversa> {
    const u = await this.unidade(tx, unidadeId);
    const s = await this.situacao(tx, u, agora);
    const servicos = await tx.servico.findMany({
      where: { ativo: true },
      orderBy: [{ ehExtra: 'asc' }, { nome: 'asc' }],
    });
    const hoje = dataLocal(agora);
    const precos = (
      await umPorVez(servicos, async (sv) => ({
        nome: sv.nome,
        valor: await precoServicoVigente(tx, sv.id, u.id, hoje),
      }))
    ).filter((p): p is { nome: string; valor: number } => p.valor !== null);
    return {
      agora,
      cliente,
      unidade: u.nome,
      endereco: u.endereco,
      horario: s.descricao,
      dentroDoHorario: s.aberto,
      link: s.link,
      precos,
    };
  }

  async estado(): Promise<EstadoBot> {
    return this.banco.daConta(async (tx) => {
      const publicado = await this.publicado(tx);
      const rascunho = await tx.botMenu.findFirst({ where: { status: 'rascunho' } });
      const anterior = await tx.botMenu.count({ where: { status: 'arquivado' } });
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
      const menuRascunho = rascunho ? lerMenu(rascunho.menu) : null;
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
        mensagens: await this.mensagens(tx),
        unidades: await umPorVez(unidades, async (u) => {
          const s = await this.situacao(tx, u, agora);
          return {
            id: u.id,
            nome: u.nome,
            horario: s.horario,
            expediente: s.expediente,
            descricao: s.descricao,
            aberto: s.aberto,
            link: s.link,
            conexao: u.botConexao
              ? { status: u.botConexao.status, numero: u.botConexao.numero }
              : null,
          };
        }),
        podeEditar: this.podeEditar(),
      };
    });
  }

  async salvarRascunho(menu: MenuBot) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      const atual = await tx.botMenu.findFirst({ where: { status: 'rascunho' } });
      if (atual) await tx.botMenu.update({ where: { id: atual.id }, data: { menu: json(menu) } });
      else await tx.botMenu.create({ data: { status: 'rascunho', menu: json(menu) } });
      return { problemas: validarMenu(menu) };
    });
  }

  async descartarRascunho() {
    this.exigirDono();
    await this.banco.daConta((tx) => tx.botMenu.deleteMany({ where: { status: 'rascunho' } }));
  }

  /** Rascunho vira o menu do bot; o que estava publicado fica guardado para voltar. */
  async publicar() {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      const rascunho = await tx.botMenu.findFirst({ where: { status: 'rascunho' } });
      if (!rascunho)
        throw Erros.requisicaoInvalida('sem_rascunho', 'Não há alterações para publicar.');
      const menu = lerMenu(rascunho.menu);
      const problemas = validarMenu(menu);
      if (problemas.length)
        throw Erros.validacao(problemas.map((p) => ({ campo: p.onde, mensagem: p.mensagem })));
      const antes = await this.publicado(tx);
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
        antes: { versao: antes.id },
        depois: { versao: rascunho.id },
      });
    });
  }

  /** Volta à última versão publicada antes desta. */
  async restaurarAnterior() {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      const anterior = await tx.botMenu.findFirst({
        where: { status: 'arquivado' },
        orderBy: { publicadoEm: 'desc' },
      });
      if (!anterior)
        throw Erros.requisicaoInvalida('sem_anterior', 'Não há versão anterior para voltar.');
      const atual = await this.publicado(tx);
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
        antes: { versao: atual.id },
        depois: { versao: anterior.id },
      });
    });
  }

  async salvarMensagens(d: MensagensBotEntrada) {
    this.exigirDono();
    return this.banco.daConta(async (tx) => {
      for (const [tipo, texto] of Object.entries(d.mensagens)) {
        const t = tipo as keyof MensagensBot;
        const atual = await tx.modeloMensagem.findFirst({ where: { unidadeId: null, tipo: t } });
        if (atual)
          await tx.modeloMensagem.update({ where: { id: atual.id }, data: { texto, ativo: true } });
        else await tx.modeloMensagem.create({ data: { tipo: t, texto: texto! } });
      }
      return this.mensagens(tx);
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
      const rascunho =
        d.versao === 'rascunho'
          ? await tx.botMenu.findFirst({ where: { status: 'rascunho' } })
          : null;
      const menu = lerMenu((rascunho ?? (await this.publicado(tx))).menu);
      const ctx = await this.contexto(tx, d.unidadeId, new Date(), d.cliente);
      if (d.foraDoHorario) ctx.dentroDoHorario = false;
      return responder(menu, await this.mensagens(tx), d.sessao, d.entrada, ctx);
    });
  }
}

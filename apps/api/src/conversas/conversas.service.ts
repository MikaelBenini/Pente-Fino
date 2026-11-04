import { Inject, Injectable } from '@nestjs/common';
import { json, mensagensDoBot, type Prisma } from '@pente-fino/db';
import {
  preencher,
  variantesTelefone,
  type ConversaResumo,
  type ListaConversas,
  type MensagemDoCliente,
  type Papel,
  type SessaoBot,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { exigirUnidade, filtroUnidade } from '../comum/escopo.js';
import { Filas } from '../filas/filas.module.js';

type Tx = Prisma.TransactionClient;

/** Quem vê e responde as conversas do bot: a recepção, e dono e gestor junto. */
export const QUEM_CONVERSA: readonly Papel[] = ['dono', 'gestor', 'recepcao'];
const LIMITE_LISTA = 60;

function lerSessao(valor: unknown): SessaoBot {
  const s = (valor ?? {}) as Partial<SessaoBot>;
  return {
    caminho: Array.isArray(s.caminho) ? s.caminho : [],
    ultimaEm: s.ultimaEm ?? new Date(0).toISOString(),
    comAtendente: s.comAtendente === true,
    erros: s.erros ?? 0,
  };
}

/**
 * Tela Conversas: o número que pediu atendente entra na fila da unidade; a equipe responde
 * pelo painel (o bot fica quieto) e devolve ao bot quando termina. As mensagens saem pela
 * mesma fila do worker que espaça as respostas do bot.
 */
@Injectable()
export class ConversasService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(Filas) private readonly filas: Filas,
  ) {}

  async listar(unidadeId: string | undefined): Promise<ListaConversas> {
    if (unidadeId) exigirUnidade(unidadeId, QUEM_CONVERSA);
    const escopo = unidadeId ? { unidadeId } : filtroUnidade(QUEM_CONVERSA);
    return this.banco.daConta(async (tx) => {
      const [aguardando, primeiro, recentes, conexoes] = await Promise.all([
        tx.botSessao.count({
          where: { ...filtroUnidade(QUEM_CONVERSA), atendenteDesde: { not: null } },
        }),
        tx.botSessao.findMany({
          where: { ...escopo, atendenteDesde: { not: null } },
          orderBy: { atendenteDesde: 'asc' },
          include: { cliente: { select: { nome: true } } },
        }),
        tx.botSessao.findMany({
          where: { ...escopo, atendenteDesde: null },
          orderBy: { atualizadoEm: 'desc' },
          take: LIMITE_LISTA,
          include: { cliente: { select: { nome: true } } },
        }),
        tx.botConexao.findMany({ where: escopo, select: { status: true } }),
      ]);
      const sessoes = [...primeiro, ...recentes];
      const ultimas = sessoes.length
        ? await tx.mensagem.findMany({
            where: {
              OR: sessoes.map((s) => ({ unidadeId: s.unidadeId, telefone: s.telefone })),
            },
            orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
            distinct: ['unidadeId', 'telefone'],
            select: { unidadeId: true, telefone: true, texto: true, direcao: true, criadoEm: true },
          })
        : [];
      const ultimaDe = new Map(ultimas.map((m) => [`${m.unidadeId}:${m.telefone}`, m]));
      const conversas: ConversaResumo[] = sessoes.map((s) => {
        const sessao = lerSessao(s.sessao);
        const m = ultimaDe.get(`${s.unidadeId}:${s.telefone}`);
        return {
          id: s.id,
          unidadeId: s.unidadeId,
          telefone: s.telefone,
          clienteId: s.clienteId,
          cliente: s.cliente?.nome ?? null,
          situacao: s.atendenteDesde ? 'aguardando' : sessao.comAtendente ? 'atendimento' : 'bot',
          aguardandoDesde: s.atendenteDesde?.toISOString() ?? null,
          ultimaMensagem: m
            ? { texto: m.texto, direcao: m.direcao, criadoEm: m.criadoEm.toISOString() }
            : null,
          atualizadoEm: s.atualizadoEm.toISOString(),
        };
      });
      return {
        conversas,
        aguardando,
        conectado: conexoes.some((c) => c.status === 'conectado'),
      };
    });
  }

  private async sessao(tx: Tx, id: string) {
    const s = await tx.botSessao.findUnique({
      where: { id },
      include: {
        cliente: { select: { nome: true } },
        unidade: { include: { botConexao: true } },
      },
    });
    if (!s) throw Erros.naoEncontrado('Conversa não encontrada.');
    exigirUnidade(s.unidadeId, QUEM_CONVERSA);
    return s;
  }

  async mensagens(id: string): Promise<MensagemDoCliente[]> {
    return this.banco.daConta(async (tx) => {
      const s = await this.sessao(tx, id);
      const ms = await tx.mensagem.findMany({
        where: { unidadeId: s.unidadeId, telefone: { in: variantesTelefone(s.telefone) } },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: 200,
      });
      return ms.reverse().map((m) => ({
        id: m.id,
        direcao: m.direcao,
        texto: m.texto,
        status: m.status,
        unidade: s.unidade.nome,
        criadoEm: m.criadoEm.toISOString(),
      }));
    });
  }

  /** Responde pelo painel: a equipe assume a conversa e o bot fica quieto. */
  async responder(id: string, texto: string): Promise<{ id: string }> {
    const r = await this.banco.daConta(async (tx) => {
      const s = await this.sessao(tx, id);
      const conexao = s.unidade.botConexao;
      if (conexao?.status !== 'conectado')
        throw Erros.conflito(
          'O WhatsApp desta unidade está desconectado. Reconecte na tela Bot para responder.',
        );
      const sessao = lerSessao(s.sessao);
      await tx.botSessao.update({
        where: { id },
        data: { sessao: json({ ...sessao, comAtendente: true, erros: 0 }), atendenteDesde: null },
      });
      const m = await this.gravarSaida(tx, s, texto);
      return { contaId: s.contaId, instancia: conexao.instancia, mensagemId: m };
    });
    await this.enfileirar(r.contaId, r.instancia, [r.mensagemId]);
    return { id: r.mensagemId };
  }

  /** Terminou: o bot volta a responder, com a mensagem de encerramento. */
  async devolver(id: string): Promise<{ ok: true }> {
    const r = await this.banco.daConta(async (tx) => {
      const s = await this.sessao(tx, id);
      const sessao = lerSessao(s.sessao);
      await tx.botSessao.update({
        where: { id },
        data: {
          sessao: json({ ...sessao, comAtendente: false, caminho: [], erros: 0 }),
          atendenteDesde: null,
        },
      });
      const conexao = s.unidade.botConexao;
      // Sem conexão, devolve em silêncio: o encerramento não teria como sair.
      if (conexao?.status !== 'conectado') return null;
      const conta = await tx.conta.findFirst({ select: { nome: true } });
      const texto = preencher((await mensagensDoBot(tx)).encerramento, {
        cliente: s.cliente?.nome.split(/\s+/)[0] ?? null,
        barbearia: conta?.nome ?? s.unidade.nome,
        unidade: s.unidade.nome,
      });
      if (!texto.trim()) return null;
      const m = await this.gravarSaida(tx, s, texto);
      return { contaId: s.contaId, instancia: conexao.instancia, mensagemId: m };
    });
    if (r) await this.enfileirar(r.contaId, r.instancia, [r.mensagemId]);
    return { ok: true };
  }

  private async gravarSaida(
    tx: Tx,
    s: { unidadeId: string; clienteId: string | null; telefone: string },
    texto: string,
  ): Promise<string> {
    const m = await tx.mensagem.create({
      data: {
        unidadeId: s.unidadeId,
        clienteId: s.clienteId,
        telefone: s.telefone,
        direcao: 'saida',
        texto,
        status: 'pendente',
      },
      select: { id: true },
    });
    return m.id;
  }

  private async enfileirar(contaId: string, instancia: string, mensagemIds: string[]) {
    await this.filas.whatsappEntrada.add(
      'enviar',
      { tipo: 'enviar', contaId, instancia, mensagemIds },
      { jobId: `enviar_${mensagemIds[0]}` },
    );
  }
}

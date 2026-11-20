import { Inject, Injectable } from '@nestjs/common';
import { json, mensagensDoBot, origemDaConversa, type Prisma } from '@pente-fino/db';
import {
  dataLocal,
  descreverPedido,
  resumoDoAnuncio,
  preencher,
  rotuloOrigem,
  situacaoDaConversa,
  variantesTelefone,
  type EstadoConversaRegistro,
  type SituacaoConversa,
  type ConversaResumo,
  type EnvioParaCliente,
  type ListaConversas,
  type MensagemDoCliente,
  type Papel,
  type SessaoBot,
} from '@pente-fino/shared';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
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
        tx.botConexao.findMany({ where: escopo, select: { unidadeId: true, status: true } }),
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
      const conectadas = new Set(
        conexoes.filter((c) => c.status === 'conectado').map((c) => c.unidadeId),
      );
      const ultimaDe = new Map(ultimas.map((m) => [`${m.unidadeId}:${m.telefone}`, m]));
      // A última resposta da equipe (pelo painel, com o nome, ou pelo celular) de cada conversa.
      const respostas = sessoes.length
        ? await tx.mensagem.findMany({
            where: {
              direcao: 'saida',
              OR: [{ autorId: { not: null } }, { peloCelular: true }],
              AND: [{ OR: sessoes.map((s) => ({ unidadeId: s.unidadeId, telefone: s.telefone })) }],
            },
            orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
            distinct: ['unidadeId', 'telefone'],
            select: {
              unidadeId: true,
              telefone: true,
              criadoEm: true,
              peloCelular: true,
              autor: { select: { nome: true } },
            },
          })
        : [];
      const respostaDe = new Map(respostas.map((m) => [`${m.unidadeId}:${m.telefone}`, m]));
      // A última mudança de estado de cada conversa: por que o bot parou (testes de 19/11).
      const estados = sessoes.length
        ? await tx.botSessaoEvento.findMany({
            where: { sessaoId: { in: sessoes.map((s) => s.id) } },
            orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
            distinct: ['sessaoId'],
            select: {
              sessaoId: true,
              criadoEm: true,
              origem: true,
              autor: { select: { nome: true } },
            },
          })
        : [];
      const estadoDe = new Map(estados.map((e) => [e.sessaoId, e]));
      // O que cada cliente já tinha escolhido no bot antes de pedir atendente.
      const pedidos = sessoes.map((s) => lerSessao(s.sessao).pedido).filter((p) => !!p);
      const ids = [
        ...new Set(
          pedidos.flatMap((p) => [
            ...p!.servicoIds,
            ...(p!.escolha ? [p!.escolha.profissionalId] : []),
            ...(p!.profissionalId ? [p!.profissionalId] : []),
          ]),
        ),
      ];
      const nomes = new Map<string, string>();
      if (ids.length) {
        for (const sv of await tx.servico.findMany({
          where: { id: { in: ids } },
          select: { id: true, nome: true },
        }))
          nomes.set(sv.id, sv.nome);
        for (const p of await tx.profissional.findMany({
          where: { id: { in: ids } },
          select: { id: true, usuario: { select: { nome: true } } },
        }))
          nomes.set(p.id, p.usuario.nome.trim().split(/\s+/)[0]!);
      }
      const hoje = dataLocal(new Date());
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
          conectado: conectadas.has(s.unidadeId),
          ultimaMensagem: m
            ? { texto: m.texto, direcao: m.direcao, criadoEm: m.criadoEm.toISOString() }
            : null,
          atualizadoEm: s.atualizadoEm.toISOString(),
          pedido: !sessao.comAtendente
            ? null
            : sessao.respostasAnuncio
              ? resumoDoAnuncio(sessao.respostasAnuncio)
              : sessao.pedido
                ? descreverPedido(sessao.pedido, nomes, hoje)
                : null,
          equipe: (() => {
            const e = respostaDe.get(`${s.unidadeId}:${s.telefone}`);
            if (!e) return null;
            return {
              quem: e.peloCelular ? null : (e.autor?.nome.trim().split(/\s+/)[0] ?? null),
              peloCelular: e.peloCelular,
              em: e.criadoEm.toISOString(),
            };
          })(),
          pedidoDados:
            sessao.comAtendente && sessao.pedido
              ? {
                  servicoIds: sessao.pedido.servicoIds,
                  profissionalId:
                    sessao.pedido.escolha?.profissionalId ?? sessao.pedido.profissionalId,
                  dia: sessao.pedido.escolha
                    ? dataLocal(new Date(sessao.pedido.escolha.inicio))
                    : sessao.pedido.dia,
                  inicio: sessao.pedido.escolha?.inicio ?? null,
                }
              : null,
          anuncio: s.anuncioEm
            ? { desde: s.anuncioEm.toISOString(), titulo: s.anuncioTitulo }
            : null,
          ultimoEstado: (() => {
            const e = estadoDe.get(s.id);
            return e
              ? {
                  em: e.criadoEm.toISOString(),
                  origem: e.origem,
                  origemTexto: rotuloOrigem(e.origem),
                  quem: e.autor?.nome.trim().split(/\s+/)[0] ?? null,
                }
              : null;
          })(),
        };
      });
      return {
        conversas,
        aguardando,
        conectado: conectadas.size > 0,
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
      await origemDaConversa(tx, 'painel_respondeu', Contexto.usuario().id);
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

  /** Assume sem precisar escrever: o bot fica quieto e a conversa sai da fila de espera. */
  async assumir(id: string): Promise<{ ok: true }> {
    await this.banco.daConta(async (tx) => {
      const s = await this.sessao(tx, id);
      const sessao = lerSessao(s.sessao);
      await origemDaConversa(tx, 'painel_assumiu', Contexto.usuario().id);
      await tx.botSessao.update({
        where: { id },
        data: {
          // Conta a partir de agora: assumir não pode fazer a conversa vencer na hora.
          sessao: json({
            ...sessao,
            comAtendente: true,
            erros: 0,
            ultimaEm: new Date().toISOString(),
          }),
          atendenteDesde: null,
        },
      });
    });
    return { ok: true };
  }

  /**
   * Terminou: o bot volta a responder, com a mensagem de encerramento. Devolve o estado que ficou
   * gravado, para a tela mostrar o que vale de fato (testes de 19/11/2026). A trava contra loop
   * passa a contar a partir de agora (botDesde), e o eco do encerramento não pausa o bot: ele é
   * reconhecido como mensagem do sistema (mesmo texto, gravado aqui).
   */
  async devolver(id: string): Promise<{ ok: true; situacao: SituacaoConversa }> {
    const r = await this.banco.daConta(async (tx) => {
      const s = await this.sessao(tx, id);
      const sessao = lerSessao(s.sessao);
      await origemDaConversa(tx, 'painel_devolveu', Contexto.usuario().id);
      const gravada = await tx.botSessao.update({
        where: { id },
        data: {
          sessao: json({
            ...sessao,
            comAtendente: false,
            caminho: [],
            erros: 0,
            botDesde: new Date().toISOString(),
          }),
          atendenteDesde: null,
        },
      });
      const situacao = situacaoDaConversa(
        gravada.atendenteDesde,
        lerSessao(gravada.sessao).comAtendente,
      );
      const conexao = s.unidade.botConexao;
      // Sem conexão, devolve em silêncio: o encerramento não teria como sair.
      if (conexao?.status !== 'conectado') return { situacao, envio: null };
      const conta = await tx.conta.findFirst({ select: { nome: true } });
      const texto = preencher((await mensagensDoBot(tx, s.unidadeId)).encerramento, {
        cliente: s.cliente?.nome.split(/\s+/)[0] ?? null,
        barbearia: conta?.nome ?? s.unidade.nome,
        unidade: s.unidade.nome,
      });
      if (!texto.trim()) return { situacao, envio: null };
      const m = await this.gravarSaida(tx, s, texto);
      return {
        situacao,
        envio: { contaId: s.contaId, instancia: conexao.instancia, mensagemId: m },
      };
    });
    if (r.envio) await this.enfileirar(r.envio.contaId, r.envio.instancia, [r.envio.mensagemId]);
    return { ok: true, situacao: r.situacao };
  }

  /** Histórico do estado da conversa: cada mudança com horário, de, para, origem e quem. */
  async estados(id: string): Promise<EstadoConversaRegistro[]> {
    return this.banco.daConta(async (tx) => {
      await this.sessao(tx, id);
      const eventos = await tx.botSessaoEvento.findMany({
        where: { sessaoId: id },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: 100,
        include: { autor: { select: { nome: true } } },
      });
      return eventos.reverse().map((e) => ({
        id: e.id,
        em: e.criadoEm.toISOString(),
        de: (e.de as SituacaoConversa | null) ?? null,
        para: e.para as SituacaoConversa,
        origem: e.origem,
        origemTexto: rotuloOrigem(e.origem),
        quem: e.autor?.nome.trim().split(/\s+/)[0] ?? null,
      }));
    });
  }

  /**
   * Pode mandar pelo número da barbearia? Só para quem já escreveu (proteção do número), não
   * pediu SAIR e com o WhatsApp da unidade conectado. Sai pela unidade em que ele escreveu.
   */
  private async envioParaCliente(tx: Tx, clienteId: string, unidadeId?: string) {
    if (unidadeId) exigirUnidade(unidadeId, QUEM_CONVERSA);
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw Erros.naoEncontrado('Cliente não encontrado.');
    const nao = (motivo: string, u: { id: string; nome: string } | null = null) => ({
      resposta: { podeBot: false, motivo, unidadeId: u?.id ?? null, unidade: u?.nome ?? null },
      envio: null,
    });
    if (!cliente.telefone) return nao('O cliente não tem telefone cadastrado.');
    const ultima = await tx.mensagem.findFirst({
      where: {
        telefone: { in: variantesTelefone(cliente.telefone) },
        direcao: 'entrada',
        ...(unidadeId ? { unidadeId } : filtroUnidade(QUEM_CONVERSA)),
      },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
      include: { unidade: { include: { botConexao: true } } },
    });
    if (!ultima)
      return nao(
        'Este cliente ainda não escreveu para o WhatsApp da barbearia. Para proteger o número, o bot só manda mensagem para quem já conversou: use o seu WhatsApp.',
      );
    const u = { id: ultima.unidadeId, nome: ultima.unidade.nome };
    if (cliente.consentimentoMsg === false && cliente.consentimentoEm !== null)
      return nao('O cliente respondeu SAIR e não quer receber mensagens da barbearia.', u);
    const conexao = ultima.unidade.botConexao;
    if (conexao?.status !== 'conectado')
      return nao(`O WhatsApp da unidade ${u.nome} está desconectado.`, u);
    return {
      resposta: { podeBot: true, motivo: null, unidadeId: u.id, unidade: u.nome },
      envio: { unidadeId: u.id, telefone: ultima.telefone, instancia: conexao.instancia, cliente },
    };
  }

  async podeEnviarParaCliente(clienteId: string, unidadeId?: string): Promise<EnvioParaCliente> {
    return this.banco.daConta(
      async (tx) => (await this.envioParaCliente(tx, clienteId, unidadeId)).resposta,
    );
  }

  /** Manda pelo bot e deixa a conversa com a equipe: a resposta do cliente cai em Conversas. */
  async enviarParaCliente(
    clienteId: string,
    texto: string,
    unidadeId?: string,
  ): Promise<{ id: string; conversaId: string }> {
    const r = await this.banco.daConta(async (tx) => {
      const { resposta, envio } = await this.envioParaCliente(tx, clienteId, unidadeId);
      if (!envio) throw Erros.conflito(resposta.motivo!);
      const chave = { unidadeId: envio.unidadeId, telefone: envio.telefone };
      const atual = await tx.botSessao.findUnique({ where: { unidadeId_telefone: chave } });
      const sessao = {
        ...lerSessao(atual?.sessao),
        // A conversa recomeça agora: conta como recente para não expirar na hora.
        ultimaEm: new Date().toISOString(),
        comAtendente: true,
        erros: 0,
      };
      await origemDaConversa(tx, 'painel_enviou', Contexto.usuario().id);
      const s = await tx.botSessao.upsert({
        where: { unidadeId_telefone: chave },
        create: { ...chave, clienteId, sessao: json(sessao), atendenteDesde: null },
        update: { clienteId, sessao: json(sessao), atendenteDesde: null },
      });
      const m = await this.gravarSaida(tx, { ...chave, clienteId }, texto);
      return { contaId: s.contaId, instancia: envio.instancia, mensagemId: m, conversaId: s.id };
    });
    await this.enfileirar(r.contaId, r.instancia, [r.mensagemId]);
    return { id: r.mensagemId, conversaId: r.conversaId };
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
        // Quem respondeu (Conversas mostra; sugestão aprovada em 16/11/2026).
        autorId: Contexto.usuario().id,
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

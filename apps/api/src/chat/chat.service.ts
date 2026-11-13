// Admin F6: chat do site com a equipe. O visitante lê e escreve com o token da conversa (o banco
// guarda só o hash); a equipe assume, responde e encerra. Conversa nova avisa a equipe na hora.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  chatEmHorario,
  dataLocal,
  DIAS_TESTE,
  formatarMoeda,
  NOME_PLANO,
  precoPorMes,
  respostasChatSchema,
  respostasProntasDoChat,
  resumirChat,
  saudeDaConta,
  TOTAL_PASSOS_ATIVACAO,
  type ContextoDoCliente,
  type RespostaPronta,
  type ChatDoVisitante,
  type ResumoDoChat,
  type ChatIniciado,
  type ConversaDaEquipe,
  type ConversaNaFila,
  type IniciarChatEntrada,
  type MensagemChat,
  type StatusChat,
} from '@pente-fino/shared';
import { contasDaPlataforma, faturasDaPlataforma } from '@pente-fino/db';
import { BancoPlataforma } from '../admin/banco-plataforma.js';
import { gerarTokenOpaco, hashToken } from '../auth/tokens.js';
import { Erros } from '../comum/erros.js';
import { EmailsService } from '../emails/emails.service.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

const primeiroNome = (n: string | null | undefined) => (n ? (n.split(' ')[0] ?? n) : null);

type MensagemDoBanco = {
  id: string;
  de: string;
  texto: string;
  criadoEm: Date;
  autor: { nome: string } | null;
};

const mensagem = (m: MensagemDoBanco, paraVisitante: boolean): MensagemChat => ({
  id: m.id,
  de: m.de === 'equipe' ? 'equipe' : 'visitante',
  autor: paraVisitante ? primeiroNome(m.autor?.nome) : (m.autor?.nome ?? null),
  texto: m.texto,
  criadoEm: m.criadoEm.toISOString(),
});

@Injectable()
export class ChatService {
  private readonly logger = new Logger('Chat');

  constructor(
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  private get db() {
    return this.banco.prisma;
  }

  // ─── Visitante ─────────────────────────────────────────────────────────

  async iniciar(d: IniciarChatEntrada): Promise<ChatIniciado> {
    const token = gerarTokenOpaco();
    const c = await this.db.conversaSuporte.create({
      data: {
        nome: d.nome,
        contato: d.contato,
        pagina: d.pagina ?? null,
        tokenHash: hashToken(token),
        mensagens: { create: { de: 'visitante', texto: d.texto } },
      },
      select: { id: true },
    });
    void this.avisarEquipe(d).catch((e: Error) =>
      this.logger.warn(`Avisar a equipe do chat novo: ${e.message}`),
    );
    return { id: c.id, token };
  }

  /** Quem marcou "Conversa nova no chat" em Meus alertas recebe na hora. */
  private async avisarEquipe(d: IniciarChatEntrada): Promise<void> {
    const equipe = await this.db.usuarioPlataforma.findMany({
      where: { ativo: true, alertas: { has: 'chat_novo' } },
      select: { email: true },
    });
    for (const p of equipe)
      await this.emails.texto({
        para: p.email,
        assunto: `Pente Fino: ${d.nome} está no chat do site`,
        texto: `${d.nome} (${d.contato}) começou uma conversa${d.pagina ? ` em ${d.pagina}` : ''}:\n\n"${d.texto.slice(0, 500)}"\n\nResponder: ${this.config.appUrl}/admin#chat`,
        modelo: 'alertas_equipe',
      });
  }

  private async doVisitante(id: string, token: string | undefined) {
    if (!token) throw Erros.naoEncontrado('Conversa não encontrada.');
    const c = await this.db.conversaSuporte.findFirst({
      where: { id, tokenHash: hashToken(token) },
      select: { id: true, status: true, criadoEm: true, atendente: { select: { nome: true } } },
    });
    if (!c) throw Erros.naoEncontrado('Conversa não encontrada.');
    return c;
  }

  async doVisitanteParaTela(id: string, token: string | undefined): Promise<ChatDoVisitante> {
    if (!token) throw Erros.naoEncontrado('Conversa não encontrada.');
    return this.paraTela(id, hashToken(token));
  }

  /** A conversa como o visitante (ou o cliente na Ajuda) vê. */
  private async paraTela(id: string, tokenHash: string): Promise<ChatDoVisitante> {
    const c = await this.db.conversaSuporte.findFirst({
      where: { id, tokenHash },
      select: {
        id: true,
        status: true,
        criadoEm: true,
        avaliacao: true,
        atendente: { select: { nome: true } },
      },
    });
    if (!c) throw Erros.naoEncontrado('Conversa não encontrada.');
    const [mensagens, antes] = await Promise.all([
      this.db.mensagemSuporte.findMany({
        where: { conversaId: id },
        orderBy: { criadoEm: 'asc' },
        take: 300,
        select: {
          id: true,
          de: true,
          texto: true,
          criadoEm: true,
          autor: { select: { nome: true } },
        },
      }),
      c.status === 'fila'
        ? this.db.conversaSuporte.count({ where: { status: 'fila', criadoEm: { lt: c.criadoEm } } })
        : Promise.resolve(0),
    ]);
    return {
      status: c.status,
      posicao: c.status === 'fila' ? antes + 1 : null,
      atendente: primeiroNome(c.atendente?.nome),
      emHorario: chatEmHorario(new Date()),
      mensagens: mensagens.map((m) => mensagem(m, true)),
      avaliacao: c.avaliacao,
    };
  }

  async doVisitanteEscrever(id: string, token: string | undefined, texto: string): Promise<void> {
    const c = await this.doVisitante(id, token);
    if (c.status === 'encerrada')
      throw Erros.conflito('Esta conversa foi encerrada. Comece uma nova pelo chat.');
    await this.db.$transaction([
      this.db.mensagemSuporte.create({ data: { conversaId: id, de: 'visitante', texto } }),
      this.db.conversaSuporte.update({ where: { id }, data: { ultimaMensagemEm: new Date() } }),
    ]);
  }

  /** O visitante avalia a conversa encerrada (pode mudar de ideia; vale a última). */
  async avaliarComToken(id: string, token: string | undefined, util: boolean): Promise<void> {
    if (!token) throw Erros.naoEncontrado('Conversa não encontrada.');
    await this.avaliar({ id, tokenHash: hashToken(token) }, util);
  }

  /** O cliente da Ajuda avalia a última conversa dele, se encerrada. */
  async avaliarDoPainel(usuarioId: string, util: boolean): Promise<void> {
    const c = await this.db.conversaSuporte.findFirst({
      where: { usuarioPainelId: usuarioId, origem: 'painel' },
      orderBy: { criadoEm: 'desc' },
      select: { id: true },
    });
    if (!c) throw Erros.naoEncontrado('Conversa não encontrada.');
    await this.avaliar({ id: c.id }, util);
  }

  private async avaliar(onde: { id: string; tokenHash?: string }, util: boolean): Promise<void> {
    const c = await this.db.conversaSuporte.findFirst({ where: onde, select: { status: true } });
    if (!c) throw Erros.naoEncontrado('Conversa não encontrada.');
    if (c.status !== 'encerrada')
      throw Erros.conflito('A avaliação abre quando a conversa é encerrada.');
    await this.db.conversaSuporte.update({ where: { id: onde.id }, data: { avaliacao: util } });
  }

  /**
   * O visitante se cadastrou pelo site depois de conversar: a conversa fica ligada à conta nova
   * (só com o segredo dela, guardado no navegador de quem conversou).
   */
  async vincularConta(id: string, token: string, contaId: string): Promise<void> {
    await this.db.conversaSuporte.updateMany({
      where: { id, tokenHash: hashToken(token), contaAfetadaId: null },
      data: { contaAfetadaId: contaId },
    });
  }

  // ─── Cliente logado (chat da Ajuda) ────────────────────────────────────

  /** A conversa mais recente deste usuário pela Ajuda (a aberta, ou a última encerrada). */
  async doPainelParaTela(usuarioId: string): Promise<ChatDoVisitante | null> {
    const c = await this.db.conversaSuporte.findFirst({
      where: { usuarioPainelId: usuarioId, origem: 'painel' },
      orderBy: { criadoEm: 'desc' },
      select: { id: true, tokenHash: true },
    });
    return c ? this.paraTela(c.id, c.tokenHash) : null;
  }

  /**
   * Mensagem do cliente pela Ajuda: continua a conversa aberta ou começa uma nova, já ligada à
   * conta e ao usuário (sem pedir nome nem contato).
   */
  async doPainelEscrever(
    quem: { usuarioId: string; nome: string; email: string; contaId: string; conta: string },
    texto: string,
  ): Promise<void> {
    const aberta = await this.db.conversaSuporte.findFirst({
      where: { usuarioPainelId: quem.usuarioId, origem: 'painel', status: { not: 'encerrada' } },
      orderBy: { criadoEm: 'desc' },
      select: { id: true },
    });
    if (aberta) {
      await this.db.$transaction([
        this.db.mensagemSuporte.create({ data: { conversaId: aberta.id, de: 'visitante', texto } }),
        this.db.conversaSuporte.update({
          where: { id: aberta.id },
          data: { ultimaMensagemEm: new Date() },
        }),
      ]);
      return;
    }
    const nome = `${quem.nome} (${quem.conta})`;
    await this.db.conversaSuporte.create({
      data: {
        nome,
        contato: quem.email,
        pagina: '/ajuda',
        origem: 'painel',
        usuarioPainelId: quem.usuarioId,
        contaAfetadaId: quem.contaId,
        tokenHash: hashToken(gerarTokenOpaco()),
        mensagens: { create: { de: 'visitante', texto } },
      },
    });
    void this.avisarEquipe({ nome, contato: quem.email, texto, pagina: '/ajuda' }).catch(
      (e: Error) => this.logger.warn(`Avisar a equipe do chat novo: ${e.message}`),
    );
  }

  // ─── Equipe ────────────────────────────────────────────────────────────

  /** Plano, situação e saúde da conta do cliente da Ajuda (a mesma nota da lista de Contas). */
  private async contexto(contaId: string): Promise<ContextoDoCliente | null> {
    const [contas, faturas] = await Promise.all([
      contasDaPlataforma(this.db),
      faturasDaPlataforma(this.db),
    ]);
    const c = contas.find((x) => x.id === contaId);
    if (!c) return null;
    const agora = new Date();
    const hoje = dataLocal(agora);
    const vencida = faturas.some(
      (f) =>
        f.conta_id === contaId &&
        (f.status === 'aberta' || f.status === 'recusada') &&
        f.vencimento.toISOString().slice(0, 10) < hoje,
    );
    const saude = saudeDaConta(
      {
        status: c.status,
        ultimoAcessoEm: c.ultimo_acesso_em?.toISOString() ?? null,
        fechadas7Dias: c.fechadas_7_dias,
        whatsappConectado: c.whatsapp_conectado,
        ativacao: Number(c.ativacao) || 0,
        totalPassos: TOTAL_PASSOS_ATIVACAO,
        cobrancaVencida: vencida,
      },
      agora,
    );
    return {
      contaId,
      conta: c.nome,
      plano: NOME_PLANO[c.plano],
      status: c.status,
      nota: saude?.nota ?? null,
      motivo: saude?.motivos[0] ?? null,
    };
  }

  /** Respostas prontas: as da equipe (Configurações) ou as de fábrica, com os valores atuais. */
  async respostas(): Promise<RespostaPronta[]> {
    const salvo = await this.db.configuracaoPlataforma.findUnique({
      where: { chave: 'respostas_chat' },
    });
    const personalizadas = respostasChatSchema.safeParse(salvo?.valor).data ?? null;
    return respostasProntasDoChat(
      {
        diasTeste: DIAS_TESTE,
        basico: formatarMoeda(precoPorMes('basico', 'mensal')),
        pro: formatarMoeda(precoPorMes('pro', 'mensal')),
        premium: formatarMoeda(precoPorMes('premium', 'mensal')),
      },
      personalizadas,
    );
  }

  /** Nome das contas ligadas às conversas (para o "virou cadastro"). */
  private async nomesDasContas(ids: (string | null)[]): Promise<Map<string, string>> {
    if (!ids.some(Boolean)) return new Map();
    const contas = await contasDaPlataforma(this.db);
    return new Map(contas.map((c) => [c.id, c.nome]));
  }

  /** Conversas dos últimos 30 dias: conversão em cadastro e tempo da primeira resposta. */
  async resumo(agora = new Date()): Promise<ResumoDoChat> {
    const conversas = await this.db.conversaSuporte.findMany({
      where: { criadoEm: { gte: new Date(agora.getTime() - 30 * 86_400_000) } },
      select: {
        criadoEm: true,
        contaAfetadaId: true,
        origem: true,
        avaliacao: true,
        mensagens: {
          where: { de: 'equipe' },
          orderBy: { criadoEm: 'asc' },
          take: 1,
          select: { criadoEm: true },
        },
      },
    });
    return resumirChat(
      conversas.map((c) => ({
        criadoEm: c.criadoEm.toISOString(),
        primeiraRespostaEm: c.mensagens[0]?.criadoEm.toISOString() ?? null,
        // Só a conta criada depois de conversar no site conta como conversão.
        virouConta: !!c.contaAfetadaId && c.origem !== 'painel',
        avaliacao: c.avaliacao,
      })),
    );
  }

  async lista(status?: StatusChat): Promise<ConversaNaFila[]> {
    const conversas = await this.db.conversaSuporte.findMany({
      where: status ? { status } : { status: { in: ['fila', 'atendendo'] } },
      orderBy: status === 'encerrada' ? { encerradaEm: 'desc' } : { criadoEm: 'asc' },
      take: status === 'encerrada' ? 50 : 200,
      include: {
        atendente: { select: { nome: true } },
        mensagens: { orderBy: { criadoEm: 'desc' }, take: 1, select: { de: true, texto: true } },
      },
    });
    const nomes = await this.nomesDasContas(conversas.map((c) => c.contaAfetadaId));
    return conversas.map((c) => this.linha(c, nomes));
  }

  private linha(
    c: {
      id: string;
      status: StatusChat;
      nome: string;
      contato: string;
      pagina: string | null;
      criadoEm: Date;
      ultimaMensagemEm: Date;
      atendente: { nome: string } | null;
      mensagens: { de: string; texto: string }[];
      contaAfetadaId: string | null;
      origem: string;
      avaliacao: boolean | null;
    },
    nomes: Map<string, string>,
  ): ConversaNaFila {
    const ultima = c.mensagens[0];
    return {
      id: c.id,
      status: c.status,
      nome: c.nome,
      contato: c.contato,
      pagina: c.pagina,
      atendente: c.atendente?.nome ?? null,
      criadoEm: c.criadoEm.toISOString(),
      ultimaMensagemEm: c.ultimaMensagemEm.toISOString(),
      ultimaMensagem: (ultima?.texto ?? '').slice(0, 120),
      esperandoEquipe: ultima?.de === 'visitante' && c.status !== 'encerrada',
      virouConta:
        c.contaAfetadaId && c.origem !== 'painel'
          ? { id: c.contaAfetadaId, nome: nomes.get(c.contaAfetadaId) ?? 'Conta criada' }
          : null,
      origem: c.origem === 'painel' ? 'painel' : 'site',
      avaliacao: c.avaliacao,
    };
  }

  async daEquipe(id: string): Promise<ConversaDaEquipe> {
    const c = await this.db.conversaSuporte.findUnique({
      where: { id },
      include: {
        atendente: { select: { nome: true } },
        mensagens: {
          orderBy: { criadoEm: 'asc' },
          take: 500,
          select: {
            id: true,
            de: true,
            texto: true,
            criadoEm: true,
            autor: { select: { nome: true } },
          },
        },
      },
    });
    if (!c) throw Erros.naoEncontrado('Conversa não encontrada.');
    const nomes = await this.nomesDasContas([c.contaAfetadaId]);
    return {
      contexto:
        c.origem === 'painel' && c.contaAfetadaId ? await this.contexto(c.contaAfetadaId) : null,
      ...this.linha({ ...c, mensagens: c.mensagens.slice(-1).reverse() }, nomes),
      mensagens: c.mensagens.map((m) => mensagem(m, false)),
    };
  }

  /** Assumir: a conversa passa a ser de quem assumiu (os outros veem o nome). */
  async assumir(id: string, adminId: string): Promise<void> {
    const r = await this.db.conversaSuporte.updateMany({
      where: { id, status: { not: 'encerrada' } },
      data: { status: 'atendendo', atendenteId: adminId, assumidaEm: new Date() },
    });
    if (r.count === 0) throw Erros.conflito('Esta conversa já foi encerrada.');
  }

  async responder(id: string, adminId: string, texto: string): Promise<void> {
    const c = await this.db.conversaSuporte.findUnique({
      where: { id },
      select: { status: true, atendenteId: true },
    });
    if (!c) throw Erros.naoEncontrado('Conversa não encontrada.');
    if (c.status === 'encerrada') throw Erros.conflito('Esta conversa já foi encerrada.');
    // Responder sem assumir assume (a fila não fica com duas pessoas sem saber).
    await this.db.$transaction([
      this.db.mensagemSuporte.create({
        data: { conversaId: id, de: 'equipe', autorId: adminId, texto },
      }),
      this.db.conversaSuporte.update({
        where: { id },
        data: {
          ultimaMensagemEm: new Date(),
          ...(c.status === 'fila' || !c.atendenteId
            ? { status: 'atendendo', atendenteId: adminId, assumidaEm: new Date() }
            : {}),
        },
      }),
    ]);
  }

  async encerrar(id: string): Promise<void> {
    const r = await this.db.conversaSuporte.updateMany({
      where: { id, status: { not: 'encerrada' } },
      data: { status: 'encerrada', encerradaEm: new Date() },
    });
    if (r.count === 0) throw Erros.conflito('Esta conversa já foi encerrada.');
  }
}

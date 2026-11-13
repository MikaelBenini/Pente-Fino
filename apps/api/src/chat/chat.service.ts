// Admin F6: chat do site com a equipe. O visitante lê e escreve com o token da conversa (o banco
// guarda só o hash); a equipe assume, responde e encerra. Conversa nova avisa a equipe na hora.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  chatEmHorario,
  type ChatDoVisitante,
  type ChatIniciado,
  type ConversaDaEquipe,
  type ConversaNaFila,
  type IniciarChatEntrada,
  type MensagemChat,
  type StatusChat,
} from '@pente-fino/shared';
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
    const c = await this.doVisitante(id, token);
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

  // ─── Equipe ────────────────────────────────────────────────────────────

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
    return conversas.map((c) => this.linha(c));
  }

  private linha(c: {
    id: string;
    status: StatusChat;
    nome: string;
    contato: string;
    pagina: string | null;
    criadoEm: Date;
    ultimaMensagemEm: Date;
    atendente: { nome: string } | null;
    mensagens: { de: string; texto: string }[];
  }): ConversaNaFila {
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
    return {
      ...this.linha({ ...c, mensagens: c.mensagens.slice(-1).reverse() }),
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

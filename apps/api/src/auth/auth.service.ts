import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { TokenAcesso, TipoToken, Transacao } from '@pente-fino/db';
import type {
  AceitarConviteEntrada,
  LoginEntrada,
  RedefinirSenhaEntrada,
  Sessao,
  TrocarSenhaEntrada,
  UsuarioSessao,
} from '@pente-fino/shared';
import { funcoesDaConta, VALIDADE_CONFIRMAR_EMAIL_H } from '@pente-fino/shared';
import { randomUUID } from 'node:crypto';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto, type UsuarioAutenticado } from '../comum/contexto.js';
import { ErroApp, Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { BloqueioLogin } from './bloqueio-login.js';
import { EmailsService } from '../emails/emails.service.js';
import { EventosService } from '../filas/filas.module.js';
import { conferirSenha, gerarHashSenha } from './senhas.js';
import { gerarTokenOpaco, hashToken, TokensAcesso } from './tokens.js';

const REDEFINIR_SENHA_VALIDADE_MS = 60 * 60_000;
const CONFIRMAR_EMAIL_VALIDADE_MS = VALIDADE_CONFIRMAR_EMAIL_H * 3_600_000;

const credenciaisInvalidas = () =>
  new ErroApp(HttpStatus.UNAUTHORIZED, 'credenciais_invalidas', 'E-mail ou senha incorretos.');
const sessaoExpirada = () =>
  new ErroApp(HttpStatus.UNAUTHORIZED, 'sessao_expirada', 'Sua sessão expirou. Entre de novo.');
const linkInvalido = () =>
  new ErroApp(
    HttpStatus.BAD_REQUEST,
    'link_invalido',
    'Este link é inválido ou expirou. Peça um novo.',
  );

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(TokensAcesso) private readonly tokens: TokensAcesso,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(EventosService) private readonly eventos: EventosService,
    @Inject(BloqueioLogin) private readonly bloqueio: BloqueioLogin,
  ) {}

  // ─── Sessão ────────────────────────────────────────────────────────────

  async login({ email, senha, contaId }: LoginEntrada): Promise<Sessao> {
    await this.bloqueio.conferir('app', email);
    // Duas contas, um login (ADR 0015): o mesmo e-mail pode ter um usuário em cada negócio.
    const usuarios = await this.banco.semConta({ loginEmail: email }, (tx) =>
      tx.usuario.findMany({
        where: { email, ativo: true },
        include: { conta: { select: { status: true } } },
        orderBy: { criadoEm: 'asc' },
      }),
    );
    // Primeiro o negócio usado por último neste aparelho; depois os que não estão suspensos.
    const suspensa = (u: (typeof usuarios)[number]) =>
      u.conta.status === 'suspensa' || u.conta.status === 'cancelada';
    const ordem = [...usuarios].sort(
      (x, y) =>
        Number(y.contaId === contaId) - Number(x.contaId === contaId) ||
        Number(suspensa(x)) - Number(suspensa(y)),
    );
    let usuario: (typeof usuarios)[number] | null = null;
    for (const u of ordem)
      if (await conferirSenha(u.senhaHash, senha)) {
        usuario = u;
        break;
      }
    // Sem usuário, confere contra nada (mesmo tempo de resposta: não revela se o e-mail existe).
    if (!usuarios.length) await conferirSenha(null, senha);
    if (!usuario) {
      await this.bloqueio.falhou('app', email);
      throw credenciaisInvalidas();
    }
    await this.bloqueio.acertou('app', email);
    if (suspensa(usuario))
      throw Erros.semPermissao('Esta conta está suspensa. Fale com o suporte do Pente Fino.');
    const escolhido = usuario;
    return this.banco.naConta(escolhido.contaId, (tx) => this.montarSessao(tx, escolhido.id));
  }

  /**
   * Trocar de negócio (duas contas, um login): quem está logado passa para a outra conta com o
   * mesmo e-mail, sem digitar a senha de novo. Só contas ativas em que esse e-mail tem acesso.
   */
  async trocarConta(contaId: string): Promise<Sessao> {
    const { id, contaId: atual, suporte } = Contexto.usuario();
    if (suporte) throw Erros.semPermissao('A sessão de suporte não troca de negócio.');
    if (contaId === atual) throw Erros.conflito('Você já está neste negócio.');
    const { email } = await this.banco.daConta((tx) =>
      tx.usuario.findUniqueOrThrow({ where: { id }, select: { email: true } }),
    );
    const alvo = await this.banco.semConta({ loginEmail: email }, (tx) =>
      tx.usuario.findFirst({
        where: { email, contaId, ativo: true },
        include: { conta: { select: { status: true } } },
      }),
    );
    if (!alvo) throw Erros.naoEncontrado('Você não tem acesso a esse negócio.');
    if (alvo.conta.status === 'suspensa' || alvo.conta.status === 'cancelada')
      throw Erros.semPermissao('Esse negócio está suspenso. Fale com o suporte do Pente Fino.');
    return this.banco.naConta(contaId, async (tx) => {
      await auditar(
        tx,
        {
          entidade: 'usuario',
          entidadeId: alvo.id,
          acao: 'trocar_de_negocio',
          depois: { de: atual },
        },
        alvo.id,
      );
      return this.montarSessao(tx, alvo.id);
    });
  }

  /**
   * Mesma senha em todos os negócios do e-mail (um login só). `revogar`: encerra as sessões
   * abertas nos outros negócios (troca e redefinição de senha).
   */
  private async sincronizarSenha(
    usuario: { id: string; email: string },
    senhaHash: string,
    revogar: boolean,
  ): Promise<void> {
    const outros = await this.banco.semConta({ loginEmail: usuario.email }, (tx) =>
      tx.usuario.findMany({
        where: { email: usuario.email, id: { not: usuario.id } },
        select: { id: true, contaId: true },
      }),
    );
    for (const o of outros)
      await this.banco.naConta(o.contaId, async (tx) => {
        await tx.usuario.update({ where: { id: o.id }, data: { senhaHash } });
        if (revogar) await this.revogarSessoes(tx, o.id);
      });
  }

  /** Troca o refreshToken por um novo (rotação). Reuso de token já trocado derruba a sessão. */
  async renovar(refreshToken: string): Promise<Sessao> {
    const token = await this.buscarToken(refreshToken);
    if (!token || token.tipo !== 'renovacao') throw sessaoExpirada();

    const resultado = await this.banco.naConta(token.contaId, async (tx) => {
      if (token.revogadoEm || token.expiraEm <= new Date()) return 'invalido' as const;
      const marcado = await tx.tokenAcesso.updateMany({
        where: { id: token.id, usadoEm: null, revogadoEm: null },
        data: { usadoEm: new Date() },
      });
      if (marcado.count === 0) {
        // Token já usado aparecendo de novo: alguém copiou. Encerra a sessão inteira.
        await tx.tokenAcesso.updateMany({
          where: { familia: token.familia, revogadoEm: null },
          data: { revogadoEm: new Date() },
        });
        return 'reuso' as const;
      }
      const usuario = await tx.usuario.findUnique({ where: { id: token.usuarioId } });
      if (!usuario?.ativo) return 'invalido' as const;
      return this.montarSessao(tx, usuario.id, token.familia ?? undefined);
    });

    if (resultado === 'reuso')
      this.logger.warn(
        `Reuso de token de renovação; sessão encerrada (usuário ${token.usuarioId}).`,
      );
    if (typeof resultado === 'string') throw sessaoExpirada();
    return resultado;
  }

  /** Encerra a sessão do refreshToken. Sempre responde igual, exista ou não. */
  async sair(refreshToken: string): Promise<void> {
    const token = await this.buscarToken(refreshToken);
    if (!token || token.tipo !== 'renovacao' || !token.familia) return;
    await this.banco.naConta(token.contaId, (tx) =>
      tx.tokenAcesso.updateMany({
        where: { familia: token.familia, revogadoEm: null },
        data: { revogadoEm: new Date() },
      }),
    );
  }

  async eu(): Promise<UsuarioSessao> {
    const { id, contaId, suporte } = Contexto.usuario();
    // Admin F5: a sessão de suporte não é um usuário da barbearia.
    if (suporte) {
      // O suporte vê o painel com o vocabulário da conta que está ajudando.
      const conta = await this.banco.daConta((tx) =>
        tx.conta.findUniqueOrThrow({
          where: { id: contaId },
          select: { segmento: true, funcoes: true, licenca: true },
        }),
      );
      return {
        id,
        segmento: conta.segmento,
        licenca: conta.licenca,
        outrasContas: [],
        funcoes: funcoesDaConta(
          conta.segmento,
          Array.isArray(conta.funcoes) ? (conta.funcoes as string[]) : null,
        ),
        nome: `Suporte Pente Fino (${suporte.nome})`,
        email: '',
        contaId,
        papeis: [{ papel: 'dono', unidadeId: null }],
        emailConfirmado: true,
        modoSuporte: { nome: suporte.nome, ate: suporte.ate },
      };
    }
    return this.banco.daConta(async (tx) => this.usuarioSessao(tx, id));
  }

  // ─── Senha ─────────────────────────────────────────────────────────────

  /** Envia o link de redefinição. A resposta não revela se o e-mail existe. */
  async esqueciSenha(email: string): Promise<void> {
    const usuario = await this.banco.semConta({ loginEmail: email }, (tx) =>
      tx.usuario.findFirst({ where: { email, ativo: true }, orderBy: { criadoEm: 'asc' } }),
    );
    if (!usuario?.ativo) return;

    const token = gerarTokenOpaco();
    await this.banco.naConta(usuario.contaId, async (tx) => {
      await tx.tokenAcesso.updateMany({
        where: { usuarioId: usuario.id, tipo: 'redefinir_senha', usadoEm: null, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      await tx.tokenAcesso.create({
        data: {
          usuarioId: usuario.id,
          tipo: 'redefinir_senha',
          hash: hashToken(token),
          expiraEm: new Date(Date.now() + REDEFINIR_SENHA_VALIDADE_MS),
          ...this.origem(),
        },
      });
    });
    await this.emails.redefinirSenha({
      para: usuario.email,
      nome: usuario.nome,
      link: `${this.config.appUrl}/redefinir-senha?token=${token}`,
    });
  }

  async redefinirSenha({ token, senha }: RedefinirSenhaEntrada): Promise<void> {
    const registro = await this.buscarToken(token);
    if (!registro || registro.tipo !== 'redefinir_senha') throw linkInvalido();
    const senhaHash = await gerarHashSenha(senha);

    const usuario = await this.banco.naConta(registro.contaId, async (tx) => {
      if (!(await this.consumir(tx, registro))) return null;
      const atualizado = await tx.usuario.update({
        where: { id: registro.usuarioId },
        data: { senhaHash },
      });
      // O link chegou pelo e-mail: ele está confirmado.
      await tx.usuario.updateMany({
        where: { id: atualizado.id, emailConfirmadoEm: null },
        data: { emailConfirmadoEm: new Date() },
      });
      await this.revogarSessoes(tx, atualizado.id);
      await auditar(
        tx,
        { entidade: 'usuario', entidadeId: atualizado.id, acao: 'redefinir_senha' },
        atualizado.id,
      );
      return atualizado;
    });
    if (!usuario) throw linkInvalido();
    await this.sincronizarSenha(usuario, senhaHash, true);
    await this.depoisDeAlterarSenha(usuario);
  }

  /** Troca com a senha atual. Encerra as outras sessões e devolve uma nova para este aparelho. */
  async trocarSenha({ senhaAtual, novaSenha }: TrocarSenhaEntrada): Promise<Sessao> {
    const { id } = Contexto.usuario();
    const usuario = await this.banco.daConta((tx) =>
      tx.usuario.findUniqueOrThrow({ where: { id } }),
    );
    if (!(await conferirSenha(usuario.senhaHash, senhaAtual))) {
      throw new ErroApp(
        HttpStatus.BAD_REQUEST,
        'senha_atual_incorreta',
        'A senha atual não confere.',
        [{ campo: 'senhaAtual', mensagem: 'A senha atual não confere.' }],
      );
    }
    const senhaHash = await gerarHashSenha(novaSenha);

    const sessao = await this.banco.daConta(async (tx) => {
      await tx.usuario.update({ where: { id }, data: { senhaHash } });
      await this.revogarSessoes(tx, id);
      await auditar(tx, { entidade: 'usuario', entidadeId: id, acao: 'trocar_senha' });
      return this.montarSessao(tx, id);
    });
    await this.sincronizarSenha(usuario, senhaHash, true);
    await this.depoisDeAlterarSenha(usuario);
    return sessao;
  }

  // ─── Convite ───────────────────────────────────────────────────────────

  /** Aceita o convite criando a senha; já devolve a sessão (entra direto). */
  async aceitarConvite({ token, senha }: AceitarConviteEntrada): Promise<Sessao> {
    const registro = await this.buscarToken(token);
    if (!registro || registro.tipo !== 'convite') throw linkInvalido();
    const senhaHash = await gerarHashSenha(senha);

    const sessao = await this.banco.naConta(registro.contaId, async (tx) => {
      if (!(await this.consumir(tx, registro))) return null;
      await tx.usuario.update({
        where: { id: registro.usuarioId },
        data: { senhaHash, ativo: true },
      });
      // O convite chegou pelo e-mail: ele está confirmado.
      await tx.usuario.updateMany({
        where: { id: registro.usuarioId, emailConfirmadoEm: null },
        data: { emailConfirmadoEm: new Date() },
      });
      await auditar(
        tx,
        { entidade: 'usuario', entidadeId: registro.usuarioId, acao: 'aceitar_convite' },
        registro.usuarioId,
      );
      return this.montarSessao(tx, registro.usuarioId);
    });
    if (!sessao) throw linkInvalido();
    // A senha criada vale também nos outros negócios do mesmo e-mail (um login só).
    await this.sincronizarSenha(
      { id: registro.usuarioId, email: sessao.usuario.email },
      senhaHash,
      false,
    );
    return sessao;
  }

  // ─── Confirmação do e-mail (cadastro pelo site) ────────────────────────────

  /** Novo link de confirmação (revoga os anteriores). Devolve o endereço para o e-mail. */
  async criarLinkDeConfirmacao(
    tx: Transacao,
    usuarioId: string,
  ): Promise<{ link: string; expiraEm: Date }> {
    await tx.tokenAcesso.updateMany({
      where: { usuarioId, tipo: 'confirmar_email', usadoEm: null, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
    const token = gerarTokenOpaco();
    const expiraEm = new Date(Date.now() + CONFIRMAR_EMAIL_VALIDADE_MS);
    await tx.tokenAcesso.create({
      data: {
        usuarioId,
        tipo: 'confirmar_email',
        hash: hashToken(token),
        expiraEm,
        ...this.origem(),
      },
    });
    return { link: `${this.config.appUrl}/confirmar-email?token=${token}`, expiraEm };
  }

  /** Link do e-mail: marca o e-mail como confirmado. Link usado de novo por quem já confirmou vale. */
  async confirmarEmail(token: string): Promise<void> {
    const registro = await this.buscarToken(token);
    if (!registro || registro.tipo !== 'confirmar_email') throw linkInvalido();
    const ok = await this.banco.naConta(registro.contaId, async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: registro.usuarioId } });
      if (!u) return false;
      if (u.emailConfirmadoEm) return true;
      if (!(await this.consumir(tx, registro))) return false;
      await tx.usuario.update({ where: { id: u.id }, data: { emailConfirmadoEm: new Date() } });
      await auditar(tx, { entidade: 'usuario', entidadeId: u.id, acao: 'confirmar_email' }, u.id);
      return true;
    });
    if (!ok) throw linkInvalido();
  }

  /** "Reenviar e-mail" no aviso do painel. Já confirmado: não manda nada. */
  async reenviarConfirmacao(): Promise<{ enviado: boolean }> {
    const { id } = Contexto.usuario();
    const r = await this.banco.daConta(async (tx) => {
      const u = await tx.usuario.findUniqueOrThrow({ where: { id } });
      if (u.emailConfirmadoEm) return null;
      return { u, ...(await this.criarLinkDeConfirmacao(tx, id)) };
    });
    if (!r) return { enviado: false };
    await this.emails.confirmarEmail({
      para: r.u.email,
      nome: r.u.nome,
      link: r.link,
      expiraEm: r.expiraEm,
    });
    return { enviado: true };
  }

  // ─── Apoio ─────────────────────────────────────────────────────────────

  private buscarToken(token: string): Promise<TokenAcesso | null> {
    const hash = hashToken(token);
    return this.banco.semConta({ tokenHash: hash }, (tx) =>
      tx.tokenAcesso.findUnique({ where: { hash } }),
    );
  }

  /** Marca o token como usado se ainda valia. Falso = usado, revogado ou expirado. */
  private async consumir(tx: Transacao, token: TokenAcesso): Promise<boolean> {
    const r = await tx.tokenAcesso.updateMany({
      where: { id: token.id, usadoEm: null, revogadoEm: null, expiraEm: { gt: new Date() } },
      data: { usadoEm: new Date() },
    });
    return r.count === 1;
  }

  private revogarSessoes(tx: Transacao, usuarioId: string) {
    return tx.tokenAcesso.updateMany({
      where: { usuarioId, tipo: 'renovacao', revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }

  private async depoisDeAlterarSenha(usuario: {
    id: string;
    contaId: string;
    email: string;
    nome: string;
  }) {
    await this.emails.senhaAlterada({ para: usuario.email, nome: usuario.nome });
    await this.eventos.publicar('usuario.senha_alterada', usuario.contaId, {
      usuarioId: usuario.id,
    });
  }

  private origem() {
    const c = Contexto.atual();
    return { ip: c?.ip ?? null, userAgent: c?.userAgent ?? null };
  }

  /**
   * Os outros negócios do mesmo login (duas contas, um login): o e-mail é declarado na transação
   * só para esta leitura (políticas login_por_email em usuario e conta) e volta a vazio em seguida.
   */
  private async outrasContasDoLogin(tx: Transacao, usuarioId: string, email: string) {
    await tx.$queryRaw`SELECT set_config('app.login_email', ${email}, true)`;
    try {
      const outros = await tx.usuario.findMany({
        where: { email, ativo: true, id: { not: usuarioId } },
        select: { conta: { select: { id: true, nome: true, licenca: true, status: true } } },
        orderBy: { criadoEm: 'asc' },
      });
      return outros
        .filter((o) => o.conta.status !== 'suspensa' && o.conta.status !== 'cancelada')
        .map((o) => ({ contaId: o.conta.id, nome: o.conta.nome, licenca: o.conta.licenca }));
    } finally {
      await tx.$queryRaw`SELECT set_config('app.login_email', '', true)`;
    }
  }

  private async usuarioSessao(tx: Transacao, usuarioId: string): Promise<UsuarioSessao> {
    const u = await tx.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: {
        papeis: true,
        conta: { select: { segmento: true, funcoes: true, licenca: true } },
      },
    });
    const outrasContas = await this.outrasContasDoLogin(tx, u.id, u.email);
    return {
      segmento: u.conta.segmento,
      licenca: u.conta.licenca,
      outrasContas,
      funcoes: funcoesDaConta(
        u.conta.segmento,
        Array.isArray(u.conta.funcoes) ? (u.conta.funcoes as string[]) : null,
      ),
      id: u.id,
      nome: u.nome,
      email: u.email,
      contaId: u.contaId,
      papeis: u.papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidadeId })),
      emailConfirmado: u.emailConfirmadoEm !== null,
    };
  }

  /** Emite a sessão (JWT + token de renovação) do usuário numa transação da conta dele. */
  async montarSessao(tx: Transacao, usuarioId: string, familia?: string): Promise<Sessao> {
    const usuario = await this.usuarioSessao(tx, usuarioId);
    const refreshToken = gerarTokenOpaco();
    const tipo: TipoToken = 'renovacao';
    await tx.tokenAcesso.create({
      data: {
        usuarioId,
        tipo,
        hash: hashToken(refreshToken),
        familia: familia ?? randomUUID(),
        expiraEm: new Date(Date.now() + this.config.renovacaoExpiraEmMs),
        ...this.origem(),
      },
    });
    const autenticado: UsuarioAutenticado = {
      id: usuario.id,
      contaId: usuario.contaId,
      papeis: usuario.papeis,
    };
    return {
      accessToken: await this.tokens.emitir(autenticado),
      expiraEm: this.config.acessoExpiraEmS,
      refreshToken,
      usuario,
    };
  }
}

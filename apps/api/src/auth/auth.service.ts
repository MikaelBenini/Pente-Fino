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
import { randomUUID } from 'node:crypto';
import { auditar } from '../auditoria/auditoria.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto, type UsuarioAutenticado } from '../comum/contexto.js';
import { ErroApp, Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { EmailsService } from '../emails/emails.service.js';
import { EventosService } from '../filas/filas.module.js';
import { conferirSenha, gerarHashSenha } from './senhas.js';
import { gerarTokenOpaco, hashToken, TokensAcesso } from './tokens.js';

const REDEFINIR_SENHA_VALIDADE_MS = 60 * 60_000;

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
  ) {}

  // ─── Sessão ────────────────────────────────────────────────────────────

  async login({ email, senha }: LoginEntrada): Promise<Sessao> {
    const usuario = await this.banco.semConta({ loginEmail: email }, (tx) =>
      tx.usuario.findUnique({ where: { email } }),
    );
    const senhaConfere = await conferirSenha(usuario?.ativo ? usuario.senhaHash : null, senha);
    if (!usuario || !usuario.ativo || !senhaConfere) throw credenciaisInvalidas();

    return this.banco.naConta(usuario.contaId, async (tx) => {
      const conta = await tx.conta.findUniqueOrThrow({ where: { id: usuario.contaId } });
      if (conta.status === 'suspensa' || conta.status === 'cancelada') {
        throw Erros.semPermissao('Esta conta está suspensa. Fale com o suporte do Pente Fino.');
      }
      return this.montarSessao(tx, usuario.id);
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
    const { id } = Contexto.usuario();
    return this.banco.daConta(async (tx) => this.usuarioSessao(tx, id));
  }

  // ─── Senha ─────────────────────────────────────────────────────────────

  /** Envia o link de redefinição. A resposta não revela se o e-mail existe. */
  async esqueciSenha(email: string): Promise<void> {
    const usuario = await this.banco.semConta({ loginEmail: email }, (tx) =>
      tx.usuario.findUnique({ where: { email } }),
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
      await this.revogarSessoes(tx, atualizado.id);
      await auditar(
        tx,
        { entidade: 'usuario', entidadeId: atualizado.id, acao: 'redefinir_senha' },
        atualizado.id,
      );
      return atualizado;
    });
    if (!usuario) throw linkInvalido();
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
      await auditar(
        tx,
        { entidade: 'usuario', entidadeId: registro.usuarioId, acao: 'aceitar_convite' },
        registro.usuarioId,
      );
      return this.montarSessao(tx, registro.usuarioId);
    });
    if (!sessao) throw linkInvalido();
    return sessao;
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

  private async usuarioSessao(tx: Transacao, usuarioId: string): Promise<UsuarioSessao> {
    const u = await tx.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { papeis: true },
    });
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      contaId: u.contaId,
      papeis: u.papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidadeId })),
    };
  }

  private async montarSessao(tx: Transacao, usuarioId: string, familia?: string): Promise<Sessao> {
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

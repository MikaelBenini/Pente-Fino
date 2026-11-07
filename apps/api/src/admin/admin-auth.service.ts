import { Inject, Injectable } from '@nestjs/common';
import type {
  EntrarAdminEntrada,
  PapelPlataforma,
  RespostaEntrarAdmin,
  UsuarioPlataformaSessao,
} from '@pente-fino/shared';
import { conferirSenha } from '../auth/senhas.js';
import { gerarTokenOpaco, hashToken } from '../auth/tokens.js';
import { Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { BancoPlataforma } from './banco-plataforma.js';
import { cifrar, conferirCodigo, decifrar, enderecoOtpauth, novoSegredo } from './totp.js';

export interface AdminAutenticado extends UsuarioPlataformaSessao {
  sessaoId: string;
  ip: string | null;
}

const RECUSA = 'E-mail, senha ou código inválidos.';

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  /** Registra na auditoria da plataforma (quem, o quê, em que conta, antes e depois, IP). */
  async auditar(d: {
    usuarioId: string | null;
    acao: string;
    contaId?: string | null;
    antes?: object | null;
    depois?: object | null;
    motivo?: string | null;
    ip: string | null;
  }): Promise<void> {
    await this.banco.prisma.auditoriaPlataforma.create({
      data: {
        usuarioId: d.usuarioId,
        acao: d.acao,
        contaAfetadaId: d.contaId ?? null,
        antes: d.antes ?? undefined,
        depois: d.depois ?? undefined,
        motivo: d.motivo ?? null,
        ip: d.ip,
      },
    });
  }

  /**
   * Login em etapas. Senha certa e autenticador ainda não confirmado: devolve o segredo para
   * configurar (e o código confirma). Com autenticador: só entra com o código. Sessão curta.
   */
  async entrar(
    d: EntrarAdminEntrada,
    origem: { ip: string | null; navegador: string | null },
    agora = new Date(),
  ): Promise<RespostaEntrarAdmin> {
    const db = this.banco.prisma;
    const u = await db.usuarioPlataforma.findUnique({ where: { email: d.email } });
    const senhaOk = await conferirSenha(u?.ativo ? u.senhaHash : null, d.senha);
    if (!u || !senhaOk) {
      await this.auditar({
        usuarioId: u?.id ?? null,
        acao: 'entrar_recusado',
        depois: { email: d.email, motivo: 'senha' },
        ip: origem.ip,
      });
      throw Erros.naoAutenticado(RECUSA);
    }
    const chave = this.config.plataforma.chave;
    let segredo = u.totpSegredo ? decifrar(u.totpSegredo, chave) : null;
    if (!u.totpConfirmadoEm) {
      if (!segredo) {
        segredo = novoSegredo();
        await db.usuarioPlataforma.update({
          where: { id: u.id },
          data: { totpSegredo: cifrar(segredo, chave) },
        });
      }
      if (!d.codigo)
        return { etapa: 'configurar', otpauth: enderecoOtpauth(u.email, segredo), segredo };
    }
    if (!d.codigo) return { etapa: 'codigo' };
    const passo = conferirCodigo(
      segredo!,
      d.codigo,
      agora,
      u.totpUltimoPasso === null ? null : Number(u.totpUltimoPasso),
    );
    if (passo === null) {
      await this.auditar({
        usuarioId: u.id,
        acao: 'entrar_recusado',
        depois: { motivo: 'codigo' },
        ip: origem.ip,
      });
      throw Erros.naoAutenticado(RECUSA);
    }
    const token = gerarTokenOpaco();
    const expiraEm = new Date(agora.getTime() + this.config.plataforma.sessaoExpiraEmMs);
    await db.$transaction([
      db.usuarioPlataforma.update({
        where: { id: u.id },
        data: {
          totpUltimoPasso: BigInt(passo),
          totpConfirmadoEm: u.totpConfirmadoEm ?? agora,
          ultimoAcessoEm: agora,
        },
      }),
      db.sessaoPlataforma.create({
        data: {
          usuarioId: u.id,
          tokenHash: hashToken(token),
          ip: origem.ip,
          navegador: origem.navegador?.slice(0, 300) ?? null,
          expiraEm,
        },
      }),
    ]);
    await this.auditar({
      usuarioId: u.id,
      acao: u.totpConfirmadoEm ? 'entrar' : 'configurar_segundo_fator',
      ip: origem.ip,
    });
    return {
      etapa: 'pronto',
      token,
      expiraEm: expiraEm.toISOString(),
      usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel as PapelPlataforma },
    };
  }

  /** Sessão válida pelo token (não expirada, não encerrada, usuário ativo); null se não. */
  async sessao(token: string, agora = new Date()): Promise<AdminAutenticado | null> {
    const s = await this.banco.prisma.sessaoPlataforma.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: true },
    });
    if (!s || s.encerradaEm || s.expiraEm <= agora || !s.usuario.ativo) return null;
    return {
      id: s.usuario.id,
      nome: s.usuario.nome,
      email: s.usuario.email,
      papel: s.usuario.papel as PapelPlataforma,
      sessaoId: s.id,
      ip: s.ip,
    };
  }

  async sair(admin: AdminAutenticado, ip: string | null): Promise<void> {
    await this.banco.prisma.sessaoPlataforma.update({
      where: { id: admin.sessaoId },
      data: { encerradaEm: new Date() },
    });
    await this.auditar({ usuarioId: admin.id, acao: 'sair', ip });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@pente-fino/db';
import {
  PODE_CONVIDAR,
  papeisNaUnidade,
  type ConvidarUsuarioEntrada,
  type Papel,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { gerarTokenOpaco, hashToken } from '../auth/tokens.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { EmailsService } from '../emails/emails.service.js';
import { EventosService } from '../filas/filas.module.js';

const CONVITE_VALIDADE_MS = 7 * 86_400_000;

const NOME_PAPEL: Record<Papel, string> = {
  dono: 'dono',
  gestor: 'gestor',
  recepcao: 'recepção',
  barbeiro: 'barbeiro',
};

export interface ConviteCriado {
  usuarioId: string;
  linkConvite: string;
  /** Link wa.me com a mensagem pronta, quando o telefone foi informado. */
  linkWhatsapp: string | null;
  expiraEm: string;
}

@Injectable()
export class ConvitesService {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(EventosService) private readonly eventos: EventosService,
  ) {}

  async convidar(dados: ConvidarUsuarioEntrada): Promise<ConviteCriado> {
    const quem = Contexto.usuario();
    // Papéis de quem convida no escopo do convite: na unidade, ou na conta inteira.
    const meusPapeis = dados.unidadeId
      ? papeisNaUnidade(quem.papeis, dados.unidadeId)
      : quem.papeis.filter((p) => p.unidadeId === null).map((p) => p.papel);
    if (!meusPapeis.some((p) => PODE_CONVIDAR[p].includes(dados.papel))) {
      throw Erros.semPermissao(
        `Seu papel não permite convidar alguém como ${NOME_PAPEL[dados.papel]} aqui.`,
      );
    }

    const token = gerarTokenOpaco();
    const expiraEm = new Date(Date.now() + CONVITE_VALIDADE_MS);

    let criado;
    try {
      criado = await this.banco.daConta(async (tx) => {
        if (dados.unidadeId && !(await tx.unidade.findUnique({ where: { id: dados.unidadeId } }))) {
          throw Erros.naoEncontrado('Unidade não encontrada.');
        }
        const conta = await tx.conta.findUniqueOrThrow({ where: { id: quem.contaId } });
        const autor = await tx.usuario.findUniqueOrThrow({ where: { id: quem.id } });

        let usuario = await tx.usuario.findUnique({ where: { email: dados.email } });
        if (usuario?.senhaHash)
          throw Erros.conflito('Esta pessoa já tem acesso. Ajuste os papéis dela na equipe.');
        if (usuario) {
          // Convite pendente: o novo substitui o anterior.
          await tx.tokenAcesso.updateMany({
            where: { usuarioId: usuario.id, tipo: 'convite', usadoEm: null, revogadoEm: null },
            data: { revogadoEm: new Date() },
          });
        } else {
          usuario = await tx.usuario.create({
            data: { nome: dados.nome, email: dados.email, telefone: dados.telefone ?? null },
          });
        }

        const jaTemPapel = await tx.papelUsuario.findFirst({
          where: { usuarioId: usuario.id, papel: dados.papel, unidadeId: dados.unidadeId },
        });
        if (!jaTemPapel) {
          await tx.papelUsuario.create({
            data: { usuarioId: usuario.id, papel: dados.papel, unidadeId: dados.unidadeId },
          });
        }
        await tx.tokenAcesso.create({
          data: { usuarioId: usuario.id, tipo: 'convite', hash: hashToken(token), expiraEm },
        });
        await auditar(tx, {
          entidade: 'usuario',
          entidadeId: usuario.id,
          acao: 'convidar',
          depois: {
            nome: usuario.nome,
            email: usuario.email,
            papel: dados.papel,
            unidadeId: dados.unidadeId,
          },
        });
        return { usuario, conta, autor };
      });
    } catch (e) {
      // E-mail é único no sistema: já existe em outra barbearia.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw Erros.conflito(
          'Este e-mail já está em uso no Pente Fino. Peça para a pessoa usar outro e-mail.',
        );
      }
      throw e;
    }

    const { usuario, conta, autor } = criado;
    const linkConvite = `${this.config.appUrl}/convite?token=${token}`;
    const telefone = dados.telefone ?? usuario.telefone;
    const mensagem =
      `Olá, ${usuario.nome}! ${autor.nome} convidou você para a equipe da ${conta.nome} no Pente Fino. ` +
      `Crie sua senha por este link: ${linkConvite}`;

    await this.emails.convite({
      para: usuario.email,
      nome: usuario.nome,
      conta: conta.nome,
      convidadoPor: autor.nome,
      link: linkConvite,
      expiraEm,
    });
    await this.eventos.publicar('usuario.convidado', quem.contaId, {
      usuarioId: usuario.id,
      papel: dados.papel,
      unidadeId: dados.unidadeId,
    });

    return {
      usuarioId: usuario.id,
      linkConvite,
      linkWhatsapp: telefone
        ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
        : null,
      expiraEm: expiraEm.toISOString(),
    };
  }
}

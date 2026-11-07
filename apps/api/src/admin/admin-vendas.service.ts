import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  aplicarModelosIniciais,
  contasDaPlataforma,
  faturasDaPlataforma,
  Prisma,
} from '@pente-fino/db';
import {
  dataLocal,
  gerarSlug,
  NOME_PLANO,
  type VendaCriada,
  type VendasDoVendedor,
  type VenderContaEntrada,
  vendasPorVendedor,
} from '@pente-fino/shared';
import { auditar } from '../auditoria/auditoria.js';
import { gerarTokenOpaco, hashToken } from '../auth/tokens.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { EmailsService } from '../emails/emails.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { BancoPlataforma } from './banco-plataforma.js';

const CONVITE_VALIDADE_MS = 7 * 86_400_000;

/**
 * Venda presencial: a conta nasce como no cadastro do site (o usuário da aplicação entra na
 * conta nova), com o dono sem senha e o convite para criar a senha. Fica registrado quem vendeu.
 */
@Injectable()
export class AdminVendasService {
  constructor(
    @Inject(BancoService) private readonly app: BancoService,
    @Inject(BancoPlataforma) private readonly plataforma: BancoPlataforma,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(EmailsService) private readonly emails: EmailsService,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(PrecosService) private readonly precos: PrecosService,
  ) {}

  async vender(
    d: VenderContaEntrada,
    quem: AdminAutenticado,
    ip: string | null,
  ): Promise<VendaCriada> {
    const existente = await this.app.semConta({ loginEmail: d.dono.email }, (tx) =>
      tx.usuario.findUnique({ where: { email: d.dono.email } }),
    );
    if (existente)
      throw Erros.conflito('Este e-mail já tem conta no Pente Fino. Use outro e-mail para o dono.');
    const desconto = await this.precos.cupomValido(d.cupom);
    const contaId = randomUUID();
    const token = gerarTokenOpaco();
    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + CONVITE_VALIDADE_MS);
    try {
      await this.app.naConta(contaId, async (tx) => {
        await tx.conta.create({
          data: {
            id: contaId,
            nome: d.barbearia,
            plano: d.plano,
            ciclo: d.ciclo,
            status: 'teste',
            testeAte: new Date(agora.getTime() + d.diasTeste * 86_400_000),
            vendedorId: quem.id,
            precosDesde: new Date(`${dataLocal(agora)}T00:00:00Z`),
            cupom: desconto.cupom,
            descontoBp: desconto.descontoBp,
          },
        });
        const unidade = await tx.unidade.create({
          data: {
            nome: 'Unidade principal',
            capacidade: 2,
            slug: `${gerarSlug(d.barbearia).slice(0, 50) || 'barbearia'}-${randomBytes(2).toString('hex')}`,
          },
        });
        const dono = await tx.usuario.create({
          data: { nome: d.dono.nome, email: d.dono.email, telefone: d.dono.telefone },
        });
        await tx.papelUsuario.create({
          data: { usuarioId: dono.id, papel: 'dono', unidadeId: null },
        });
        await aplicarModelosIniciais(tx, {
          unidadeIds: [unidade.id],
          vigenciaInicio: dataLocal(agora),
          incluirServicos: false,
        });
        await tx.tokenAcesso.create({
          data: { usuarioId: dono.id, tipo: 'convite', hash: hashToken(token), expiraEm },
        });
        // Na auditoria da barbearia, sem usuário dela (veio da administração).
        await auditar(tx, {
          entidade: 'conta',
          entidadeId: contaId,
          acao: 'criar_pela_venda',
          depois: { nome: d.barbearia, plano: d.plano, ciclo: d.ciclo, diasTeste: d.diasTeste },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw Erros.conflito(
          'Este e-mail já tem conta no Pente Fino. Use outro e-mail para o dono.',
        );
      throw e;
    }
    await this.auth.auditar({
      usuarioId: quem.id,
      acao: 'vender',
      contaId,
      depois: {
        cupom: desconto.cupom,
        barbearia: d.barbearia,
        dono: d.dono.email,
        plano: d.plano,
        ciclo: d.ciclo,
        diasTeste: d.diasTeste,
      },
      ip,
    });
    const linkConvite = `${this.config.appUrl}/convite?token=${token}`;
    await this.emails.ativacaoConta({
      para: d.dono.email,
      nome: d.dono.nome,
      conta: d.barbearia,
      vendedor: quem.nome,
      link: linkConvite,
      expiraEm,
    });
    const mensagem =
      `Olá, ${d.dono.nome}! Sua conta da ${d.barbearia} no Pente Fino (${NOME_PLANO[d.plano]}) está pronta. ` +
      `Crie sua senha por este link: ${linkConvite}`;
    return {
      contaId,
      linkConvite,
      linkWhatsapp: d.dono.telefone
        ? `https://wa.me/${d.dono.telefone}?text=${encodeURIComponent(mensagem)}`
        : null,
      expiraEm: expiraEm.toISOString(),
    };
  }

  /** Vendedor só mexe nas contas que vendeu; admin, em todas. */
  async exigirAcesso(contaId: string, quem: AdminAutenticado): Promise<void> {
    if (quem.papel === 'admin') return;
    const conta = (await contasDaPlataforma(this.plataforma.prisma)).find((c) => c.id === contaId);
    if (!conta || conta.vendedor_id !== quem.id) throw Erros.naoEncontrado('Conta não encontrada.');
  }

  async vendas(): Promise<VendasDoVendedor[]> {
    const db = this.plataforma.prisma;
    const [vendedores, contas, faturas] = await Promise.all([
      db.usuarioPlataforma.findMany({ select: { id: true, nome: true } }),
      contasDaPlataforma(db),
      faturasDaPlataforma(db),
    ]);
    return vendasPorVendedor({
      vendedores,
      contas: contas.map((c) => ({
        id: c.id,
        vendedorId: c.vendedor_id,
        donoAtivou: c.dono_ativou,
      })),
      contasPagas: new Set(faturas.filter((f) => f.status === 'paga').map((f) => f.conta_id)),
    }).filter((v) => v.criadas > 0);
  }
}

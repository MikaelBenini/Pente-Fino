// Administração prática (Etapa 15.2): o que precisa de atenção, cobranças de todas as contas,
// equipe da plataforma (sem precisar do servidor) e a auditoria para consulta.
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { conexoesCaidasPlataforma, contasDaPlataforma, faturasDaPlataforma } from '@pente-fino/db';
import {
  dataLocal,
  filtroAuditoriaSchema,
  mudarMembroSchema,
  novoMembroSchema,
  pendenciasDaPlataforma,
  resumirCobrancas,
  resumoDaMudanca,
  type AcessoTemporario,
  type EventoDaAuditoria,
  type FiltroAuditoria,
  type MembroDaPlataforma,
  type MudarMembro,
  type NovoMembro,
  type Pendencia,
  type ResumoCobrancas,
} from '@pente-fino/shared';
import { randomBytes } from 'node:crypto';
import { Publico } from '../auth/decoradores.js';
import { gerarHashSenha } from '../auth/senhas.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';
import { SaudeService } from './admin-config.controller.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { AdminAtual, AdminGuard, IpDaRequisicao, PapeisPlataforma } from './admin.guard.js';
import { BancoPlataforma } from './banco-plataforma.js';
import { contaParaTela } from './conta-para-tela.js';

const senhaTemporaria = () => randomBytes(12).toString('base64url');

@ApiTags('Administração do sistema')
@ApiBearerAuth()
@Controller('admin')
@Publico()
@UseGuards(AdminGuard)
export class AdminGestaoController {
  constructor(
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(SaudeService) private readonly saude: SaudeService,
  ) {}

  /** Contas e cobranças que quem está logado pode ver (vendedor: só as que vendeu). */
  private async contasECobrancas(a: AdminAutenticado) {
    const [linhas, faturas] = await Promise.all([
      contasDaPlataforma(this.banco.prisma),
      faturasDaPlataforma(this.banco.prisma),
    ]);
    const contas = linhas
      .filter((c) => a.papel === 'admin' || c.vendedor_id === a.id)
      .map(contaParaTela);
    const porId = new Map(contas.map((c) => [c.id, c]));
    const cobrancas = faturas
      .filter((f) => porId.has(f.conta_id) && f.status !== 'cancelada')
      .map((f) => ({
        contaId: f.conta_id,
        conta: porId.get(f.conta_id)!.nome,
        vendedorId: porId.get(f.conta_id)!.vendedorId,
        valor: f.valor,
        status: f.status,
        origem: f.origem,
        forma: f.forma,
        vencimento: f.vencimento.toISOString().slice(0, 10),
        pagaEm: f.paga_em?.toISOString() ?? null,
      }));
    return { contas, cobrancas };
  }

  @Get('pendencias')
  @ApiOperation({
    summary:
      'O que precisa de atenção hoje (cobrança, teste, uso, ativação, WhatsApp caído, e-mail que não saiu)',
  })
  async pendencias(@AdminAtual() a: AdminAutenticado): Promise<Pendencia[]> {
    const { contas, cobrancas } = await this.contasECobrancas(a);
    const agora = new Date();
    const caidas = await conexoesCaidasPlataforma(this.banco.prisma);
    // E-mail é do sistema, não de uma conta: só o admin vê (o vendedor vê as contas dele).
    const falhasEmail =
      a.papel === 'admin' ? await this.saude.falhasDeEmail(agora.getTime() - 86_400_000) : [];
    return pendenciasDaPlataforma(contas, cobrancas, agora, {
      conexoesCaidas: caidas.map((c) => ({
        contaId: c.conta_id,
        unidade: c.unidade,
        caiuEm: c.caiu_em.toISOString(),
      })),
      falhasEmail,
    });
  }

  @Get('cobrancas')
  @ApiOperation({ summary: 'Cobranças em aberto, vencidas e recebidas de todas as contas' })
  async cobrancas(@AdminAtual() a: AdminAutenticado): Promise<ResumoCobrancas> {
    const { cobrancas } = await this.contasECobrancas(a);
    return resumirCobrancas(cobrancas, dataLocal(new Date()));
  }

  // ─── Equipe da plataforma ───────────────────────────────────────────────

  @Get('equipe')
  @PapeisPlataforma('admin')
  @ApiOperation({ summary: 'Quem opera o sistema: papel, autenticador, último acesso e vendas' })
  async equipe(): Promise<MembroDaPlataforma[]> {
    const [membros, contas] = await Promise.all([
      this.banco.prisma.usuarioPlataforma.findMany({
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      }),
      contasDaPlataforma(this.banco.prisma),
    ]);
    return membros.map((m) => ({
      id: m.id,
      nome: m.nome,
      email: m.email,
      papel: m.papel,
      ativo: m.ativo,
      segundoFatorConfigurado: !!m.totpConfirmadoEm,
      ultimoAcessoEm: m.ultimoAcessoEm?.toISOString() ?? null,
      criadoEm: m.criadoEm.toISOString(),
      contasVendidas: contas.filter((c) => c.vendedor_id === m.id).length,
    }));
  }

  @Post('equipe')
  @PapeisPlataforma('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dar acesso a alguém (senha temporária; autenticador no 1º acesso)' })
  async criarMembro(
    @Corpo(novoMembroSchema) d: NovoMembro,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<AcessoTemporario> {
    const existe = await this.banco.prisma.usuarioPlataforma.findUnique({
      where: { email: d.email },
    });
    if (existe) throw Erros.conflito('Este e-mail já tem acesso. Use "Redefinir acesso".');
    const senha = senhaTemporaria();
    const m = await this.banco.prisma.usuarioPlataforma.create({
      data: {
        nome: d.nome,
        email: d.email,
        papel: d.papel,
        senhaHash: await gerarHashSenha(senha),
      },
    });
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'criar_membro',
      depois: { email: d.email, nome: d.nome, papel: d.papel },
      ip,
    });
    return { id: m.id, email: m.email, senha };
  }

  @Put('equipe/:id')
  @PapeisPlataforma('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mudar o papel ou desativar/reativar (desativar encerra as sessões)' })
  async mudarMembro(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(mudarMembroSchema) d: MudarMembro,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    if (id === a.id) throw Erros.conflito('Você não pode mudar o próprio acesso.');
    const m = await this.banco.prisma.usuarioPlataforma.findUnique({ where: { id } });
    if (!m) throw Erros.naoEncontrado('Pessoa não encontrada.');
    await this.banco.prisma.$transaction([
      this.banco.prisma.usuarioPlataforma.update({ where: { id }, data: d }),
      ...(d.ativo === false || (d.papel && d.papel !== m.papel)
        ? [
            this.banco.prisma.sessaoPlataforma.updateMany({
              where: { usuarioId: id, encerradaEm: null },
              data: { encerradaEm: new Date() },
            }),
          ]
        : []),
    ]);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'mudar_membro',
      antes: { email: m.email, papel: m.papel, ativo: m.ativo },
      depois: { email: m.email, papel: d.papel ?? m.papel, ativo: d.ativo ?? m.ativo },
      ip,
    });
  }

  @Post('equipe/:id/redefinir')
  @PapeisPlataforma('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Senha nova e autenticador do zero (quem perdeu o celular)' })
  async redefinirMembro(
    @Param('id', ParseUUIDPipe) id: string,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<AcessoTemporario> {
    if (id === a.id)
      throw Erros.conflito('Para redefinir o seu acesso, peça a outro admin ou use o servidor.');
    const m = await this.banco.prisma.usuarioPlataforma.findUnique({ where: { id } });
    if (!m) throw Erros.naoEncontrado('Pessoa não encontrada.');
    const senha = senhaTemporaria();
    await this.banco.prisma.$transaction([
      this.banco.prisma.usuarioPlataforma.update({
        where: { id },
        data: {
          senhaHash: await gerarHashSenha(senha),
          totpSegredo: null,
          totpConfirmadoEm: null,
          totpUltimoPasso: null,
          ativo: true,
        },
      }),
      this.banco.prisma.sessaoPlataforma.updateMany({
        where: { usuarioId: id, encerradaEm: null },
        data: { encerradaEm: new Date() },
      }),
    ]);
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'redefinir_membro',
      depois: { email: m.email },
      ip,
    });
    return { id, email: m.email, senha };
  }

  // ─── Auditoria ──────────────────────────────────────────────────────────

  @Get('auditoria')
  @PapeisPlataforma('admin')
  @ApiOperation({ summary: 'Últimas 300 ações da administração, com filtros' })
  async auditoria(@Query() q: Record<string, string>): Promise<EventoDaAuditoria[]> {
    const r = filtroAuditoriaSchema.safeParse(
      Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '')),
    );
    if (!r.success) throw Erros.requisicaoInvalida('filtro_invalido', 'Filtro inválido.');
    const f: FiltroAuditoria = r.data;
    const fim = f.ate ? new Date(Date.parse(`${f.ate}T00:00:00Z`) + 86_400_000) : undefined;
    const [eventos, contas] = await Promise.all([
      this.banco.prisma.auditoriaPlataforma.findMany({
        where: {
          ...(f.usuario ? { usuarioId: f.usuario } : {}),
          ...(f.acao ? { acao: f.acao } : {}),
          ...(f.conta ? { contaAfetadaId: f.conta } : {}),
          ...(f.de || fim
            ? {
                criadoEm: {
                  ...(f.de ? { gte: new Date(`${f.de}T00:00:00Z`) } : {}),
                  ...(fim ? { lt: fim } : {}),
                },
              }
            : {}),
        },
        include: { usuario: { select: { nome: true } } },
        orderBy: { criadoEm: 'desc' },
        take: 300,
      }),
      contasDaPlataforma(this.banco.prisma),
    ]);
    const nomes = new Map(contas.map((c) => [c.id, c.nome]));
    return eventos.map((e) => ({
      id: e.id,
      quando: e.criadoEm.toISOString(),
      quem: e.usuario?.nome ?? (e.usuarioId ? null : 'Servidor'),
      acao: e.acao,
      contaId: e.contaAfetadaId,
      conta: e.contaAfetadaId ? (nomes.get(e.contaAfetadaId) ?? null) : null,
      motivo: e.motivo,
      ip: e.ip,
      detalhe: resumoDaMudanca(e.antes, e.depois),
    }));
  }
}

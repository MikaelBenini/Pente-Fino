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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { contasDaPlataforma, faturasDaPlataforma } from '@pente-fino/db';
import {
  entrarAdminSchema,
  mudarPlanoContaSchema,
  mudarSituacaoContaSchema,
  mudarTesteContaSchema,
  registrarPagamentoSchema,
  venderContaSchema,
  type VendaCriada,
  type VendasDoVendedor,
  type VenderContaEntrada,
  type FichaContaPlataforma,
  type MudarPlanoContaEntrada,
  type MudarSituacaoContaEntrada,
  type MudarTesteContaEntrada,
  type RegistrarPagamentoEntrada,
  metricasDaPlataforma,
  type MetricasDaPlataforma,
  type ContaNaPlataforma,
  type EntrarAdminEntrada,
  type RespostaEntrarAdmin,
  type UsuarioPlataformaSessao,
} from '@pente-fino/shared';
import type { Request } from 'express';
import { LimiteAutenticacao, Publico } from '../auth/decoradores.js';
import { Corpo } from '../comum/validacao.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { AdminAtual, AdminGuard, IpDaRequisicao, PapeisPlataforma } from './admin.guard.js';
import { AdminContasService } from './admin-contas.service.js';
import { AdminVendasService } from './admin-vendas.service.js';
import { PrecosService } from '../comum/precos.service.js';
import { BancoPlataforma } from './banco-plataforma.js';

const iso = (d: Date | null) => d?.toISOString() ?? null;

@ApiTags('Administração do sistema')
@Controller('admin')
export class AdminAuthController {
  constructor(@Inject(AdminAuthService) private readonly auth: AdminAuthService) {}

  @Post('auth/entrar')
  @Publico()
  @LimiteAutenticacao()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Entrar na administração: senha e código do autenticador (configura no 1º acesso)',
  })
  entrar(
    @Corpo(entrarAdminSchema) d: EntrarAdminEntrada,
    @IpDaRequisicao() ip: string | null,
    @Req() req: Request,
  ): Promise<RespostaEntrarAdmin> {
    return this.auth.entrar(d, { ip, navegador: req.get('user-agent') ?? null });
  }
}

@ApiTags('Administração do sistema')
@ApiBearerAuth()
@Controller('admin')
@Publico()
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(AdminContasService) private readonly contasServico: AdminContasService,
    @Inject(AdminVendasService) private readonly vendasServico: AdminVendasService,
    @Inject(PrecosService) private readonly precos: PrecosService,
  ) {}

  @Get('eu')
  @ApiOperation({ summary: 'Quem está na administração' })
  eu(@AdminAtual() a: AdminAutenticado): UsuarioPlataformaSessao {
    return { id: a.id, nome: a.nome, email: a.email, papel: a.papel };
  }

  @Post('auth/sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerrar a sessão da administração' })
  sair(@AdminAtual() a: AdminAutenticado, @IpDaRequisicao() ip: string | null): Promise<void> {
    return this.auth.sair(a, ip);
  }

  @Get('metricas')
  @PapeisPlataforma('admin')
  @ApiOperation({
    summary: 'Números do negócio: contas, MRR, conversão do teste, cancelamentos e renovações',
  })
  async metricas(): Promise<MetricasDaPlataforma> {
    const [contas, faturas] = await Promise.all([
      contasDaPlataforma(this.banco.prisma),
      faturasDaPlataforma(this.banco.prisma),
    ]);
    return metricasDaPlataforma({
      agora: new Date(),
      contas: contas.map((c) => ({
        id: c.id,
        plano: c.plano,
        ciclo: c.ciclo,
        status: c.status,
        criadaEm: c.criado_em,
        testeAte: c.teste_ate,
        cobrancaAutomatica: c.cobranca_automatica,
        canceladaEm: c.cancelada_em,
        motivoCancelamento: c.motivo_cancelamento,
        unidades: c.unidades,
        precosDesde: c.precos_desde?.toISOString().slice(0, 10) ?? null,
      })),
      tabelas: await this.precos.tabelas(),
      faturas: faturas.map((f) => ({
        contaId: f.conta_id,
        status: f.status,
        vencimento: f.vencimento.toISOString().slice(0, 10),
        valor: f.valor,
      })),
    });
  }

  @Get('contas')
  @ApiOperation({
    summary: 'Contas das barbearias: plano, situação, datas e uso (sem dado de cliente)',
  })
  async contas(@AdminAtual() a: AdminAutenticado): Promise<ContaNaPlataforma[]> {
    // Vendedor vê só as contas que vendeu.
    const linhas = (await contasDaPlataforma(this.banco.prisma)).filter(
      (c) => a.papel === 'admin' || c.vendedor_id === a.id,
    );
    return linhas.map((c) => ({
      id: c.id,
      nome: c.nome,
      plano: c.plano,
      ciclo: c.ciclo,
      status: c.status,
      criadaEm: c.criado_em.toISOString(),
      testeAte: iso(c.teste_ate),
      configuradaEm: iso(c.configurada_em),
      cobrancaAutomatica: c.cobranca_automatica,
      canceladaEm: iso(c.cancelada_em),
      motivoCancelamento: c.motivo_cancelamento,
      vendedorId: c.vendedor_id,
      donoAtivou: c.dono_ativou,
      unidades: c.unidades,
      profissionais: c.profissionais,
      whatsappConectado: c.whatsapp_conectado,
      fechadas7Dias: c.fechadas_7_dias,
      ultimaFechadaEm: iso(c.ultima_fechada_em),
      ultimoAcessoEm: iso(c.ultimo_acesso_em),
    }));
  }

  @Get('contas/:id')
  @ApiOperation({ summary: 'Ficha da conta: donos, unidades, plano, datas, cobrança e histórico' })
  async ficha(
    @Param('id', ParseUUIDPipe) id: string,
    @AdminAtual() a: AdminAutenticado,
  ): Promise<FichaContaPlataforma> {
    await this.vendasServico.exigirAcesso(id, a);
    return this.contasServico.ficha(id);
  }

  @Put('contas/:id/plano')
  @PapeisPlataforma('admin')
  @ApiOperation({ summary: 'Mudar plano e ciclo (motivo obrigatório; o Asaas acompanha)' })
  mudarPlano(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(mudarPlanoContaSchema) d: MudarPlanoContaEntrada,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ) {
    return this.contasServico.mudarPlano(id, d, a, ip);
  }

  @Put('contas/:id/teste')
  @PapeisPlataforma('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Estender o teste ou dar cortesia até uma data (motivo obrigatório)' })
  mudarTeste(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(mudarTesteContaSchema) d: MudarTesteContaEntrada,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    return this.contasServico.mudarTeste(id, d, a, ip);
  }

  @Put('contas/:id/situacao')
  @PapeisPlataforma('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bloquear, desbloquear ou cancelar (só consulta, nada se apaga)' })
  mudarSituacao(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(mudarSituacaoContaSchema) d: MudarSituacaoContaEntrada,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    return this.contasServico.mudarSituacao(id, d, a, ip);
  }

  @Post('contas/:id/pagamentos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar pagamento manual (Pix, dinheiro, maquininha, boleto, transferência)',
  })
  async registrarPagamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Corpo(registrarPagamentoSchema) d: RegistrarPagamentoEntrada,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ) {
    await this.vendasServico.exigirAcesso(id, a);
    return this.contasServico.registrarPagamento(id, d, a, ip);
  }

  @Post('contas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Venda presencial: cria a conta e manda ao dono o convite para criar a senha',
  })
  vender(
    @Corpo(venderContaSchema) d: VenderContaEntrada,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<VendaCriada> {
    return this.vendasServico.vender(d, a, ip);
  }

  @Get('vendas')
  @PapeisPlataforma('admin')
  @ApiOperation({ summary: 'Vendas por vendedor: contas criadas, ativadas pelo dono e pagas' })
  vendas(): Promise<VendasDoVendedor[]> {
    return this.vendasServico.vendas();
  }
}

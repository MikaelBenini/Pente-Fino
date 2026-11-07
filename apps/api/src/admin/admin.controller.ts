import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { contasDaPlataforma, faturasDaPlataforma } from '@pente-fino/db';
import {
  entrarAdminSchema,
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
      })),
      faturas: faturas.map((f) => ({
        contaId: f.conta_id,
        status: f.status,
        vencimento: f.vencimento.toISOString().slice(0, 10),
        valor: f.valor,
      })),
    });
  }

  @Get('contas')
  @PapeisPlataforma('admin')
  @ApiOperation({
    summary: 'Contas das barbearias: plano, situação, datas e uso (sem dado de cliente)',
  })
  async contas(): Promise<ContaNaPlataforma[]> {
    const linhas = await contasDaPlataforma(this.banco.prisma);
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
      unidades: c.unidades,
      profissionais: c.profissionais,
      whatsappConectado: c.whatsapp_conectado,
      fechadas7Dias: c.fechadas_7_dias,
      ultimaFechadaEm: iso(c.ultima_fechada_em),
      ultimoAcessoEm: iso(c.ultimo_acesso_em),
    }));
  }
}

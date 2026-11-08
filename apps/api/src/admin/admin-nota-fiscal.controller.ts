// Nota fiscal das mensalidades do Pente Fino (Etapa 23): a administração configura o serviço e
// o ISS, confere os dados fiscais no Asaas e aplica a configuração às assinaturas existentes.
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assinaturasAsaasPlataforma } from '@pente-fino/db';
import {
  configNotaFiscalSchema,
  type ConfigNotaFiscal,
  type ResultadoAplicarNota,
  type ServicoMunicipal,
  type SituacaoFiscalAsaas,
} from '@pente-fino/shared';
import { Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { Corpo } from '../comum/validacao.js';
import { ErroCobranca, PROVEDOR_COBRANCA, type ProvedorCobranca } from '../cobranca/provedor.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';
import { AdminAtual, AdminGuard, IpDaRequisicao, PapeisPlataforma } from './admin.guard.js';
import { BancoPlataforma } from './banco-plataforma.js';

const CHAVE = 'nota_fiscal';

@ApiTags('Administração do sistema')
@ApiBearerAuth()
@Controller('admin/configuracoes/nota-fiscal')
@Publico()
@UseGuards(AdminGuard)
@PapeisPlataforma('admin')
export class AdminNotaFiscalController {
  constructor(
    @Inject(BancoPlataforma) private readonly banco: BancoPlataforma,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(PROVEDOR_COBRANCA) private readonly provedor: ProvedorCobranca,
  ) {}

  /** Erro do Asaas vira mensagem na tela; o resto (rede) também, sem derrubar a página. */
  private async noAsaas<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ErroCobranca) throw Erros.conflito(e.message);
      throw Erros.conflito('Não deu para falar com o Asaas agora. Tente de novo em instantes.');
    }
  }

  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Nota fiscal das mensalidades: serviço, ISS e quando emitir' })
  async salvar(
    @Corpo(configNotaFiscalSchema) d: ConfigNotaFiscal,
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<void> {
    const db = this.banco.prisma;
    const antes = await db.configuracaoPlataforma.findUnique({ where: { chave: CHAVE } });
    await db.configuracaoPlataforma.upsert({
      where: { chave: CHAVE },
      create: { chave: CHAVE, valor: d, atualizadoPorId: a.id },
      update: { valor: d, atualizadoEm: new Date(), atualizadoPorId: a.id },
    });
    await this.auth.auditar({
      usuarioId: a.id,
      acao: `configurar_${CHAVE}`,
      antes: antes ? { valor: antes.valor } : null,
      depois: { valor: d },
      ip,
    });
  }

  @Get('asaas')
  @ApiOperation({ summary: 'Dados fiscais da conta do Pente Fino no Asaas (inscrição, acesso)' })
  async situacao(): Promise<SituacaoFiscalAsaas> {
    return this.noAsaas(() => this.provedor.situacaoFiscal());
  }

  @Get('servicos')
  @ApiOperation({
    summary: 'Serviços da prefeitura cadastrados no Asaas (busca por nome ou código)',
  })
  async servicos(@Query('busca') busca?: string): Promise<ServicoMunicipal[]> {
    return this.noAsaas(() => this.provedor.servicosMunicipais((busca ?? '').trim().slice(0, 60)));
  }

  @Post('aplicar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aplicar a configuração salva a todas as assinaturas do sistema que já existem',
  })
  async aplicar(
    @AdminAtual() a: AdminAutenticado,
    @IpDaRequisicao() ip: string | null,
  ): Promise<ResultadoAplicarNota> {
    const db = this.banco.prisma;
    const guardada = await db.configuracaoPlataforma.findUnique({ where: { chave: CHAVE } });
    const c = configNotaFiscalSchema.safeParse(guardada?.valor);
    if (!c.success || !c.data.ativa)
      throw Erros.conflito('Ligue e salve a nota fiscal antes de aplicar às assinaturas.');
    const r: ResultadoAplicarNota = { aplicadas: 0, falhas: [] };
    // Uma por vez: o Asaas limita pedidos por minuto e a lista é pequena.
    for (const s of await assinaturasAsaasPlataforma(db)) {
      try {
        await this.provedor.configurarNotaAssinatura(s.asaas_assinatura_id, c.data);
        r.aplicadas++;
      } catch (e) {
        r.falhas.push({ conta: s.conta, motivo: (e as Error).message });
      }
    }
    await this.auth.auditar({
      usuarioId: a.id,
      acao: 'aplicar_nota_fiscal',
      antes: null,
      depois: { aplicadas: r.aplicadas, falhas: r.falhas.length },
      ip,
    });
    return r;
  }
}

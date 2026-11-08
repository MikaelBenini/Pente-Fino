import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuditoriaInterceptor } from './auditoria/auditoria.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AssinaturaGuard } from './assinatura/assinatura.guard.js';
import { PlanoGuard } from './assinatura/plano.guard.js';
import { CobrancaService } from './cobranca/cobranca.service.js';
import { AssistenteController } from './me/assistente.controller.js';
import { PushController } from './me/push.controller.js';
import { ClubeController } from './clube/clube.controller.js';
import { ClubeOnlineController, ClubePublicoController } from './clube/clube-online.controller.js';
import { ClubeOnlineService } from './clube/clube-online.service.js';
import { EsperaController } from './agenda/espera.controller.js';
import { provedorCobranca } from './cobranca/provedor.js';
import { WebhookAsaasController } from './cobranca/webhook-asaas.controller.js';
import { AutenticacaoGuard, PermissaoGuard } from './auth/guardas.js';
import { limitesDeRequisicao } from './auth/limite.js';
import { TokensAcesso } from './auth/tokens.js';
import { BancoService } from './comum/banco.service.js';
import { Contexto } from './comum/contexto.js';
import { FiltroErros } from './comum/filtro-erros.js';
import { CONFIGURACAO, type Configuracao } from './config/configuracao.js';
import { ConfiguracaoModule } from './config/configuracao.module.js';
import { EmailsService } from './emails/emails.service.js';
import { FilasModule } from './filas/filas.module.js';
import { RaizController } from './saude/raiz.controller.js';
import { SaudeController } from './saude/saude.controller.js';
import { ConvitesService } from './usuarios/convites.service.js';
import { UnidadesController } from './unidades/unidades.controller.js';
import { AgendaController } from './agenda/agenda.controller.js';
import { AgendaService } from './agenda/agenda.service.js';
import { CaixaController } from './caixa/caixa.controller.js';
import { ConfiguracaoController } from './configuracao/configuracao.controller.js';
import { ExportacaoController } from './exportacao/exportacao.controller.js';
import { ImportacaoController } from './importacao/importacao.controller.js';
import { HorarioPublicoController } from './publico/horario-publico.controller.js';
import { PublicoController } from './publico/publico.controller.js';
import { ComissoesController } from './comissoes/comissoes.controller.js';
import { ComissoesService } from './comissoes/comissoes.service.js';
import { DesempenhoController } from './desempenho/desempenho.controller.js';
import { OcupacaoController } from './desempenho/ocupacao.controller.js';
import { RedeController } from './desempenho/rede.controller.js';
import { SistemaController } from './conta/sistema.controller.js';
import { AdminAuthController, AdminController } from './admin/admin.controller.js';
import { AdminConfigController, SaudeService } from './admin/admin-config.controller.js';
import { AdminNotaFiscalController } from './admin/admin-nota-fiscal.controller.js';
import { AdminGestaoController } from './admin/admin-gestao.controller.js';
import { BloqueioLogin } from './auth/bloqueio-login.js';
import { EmailConfirmadoGuard } from './auth/email-confirmado.guard.js';
import { LimiteCadastro } from './publico/limite-cadastro.js';
import { AdminAuthService } from './admin/admin-auth.service.js';
import { AdminContasService } from './admin/admin-contas.service.js';
import { AdminVendasService } from './admin/admin-vendas.service.js';
import { PrecosService } from './comum/precos.service.js';
import { AdminGuard } from './admin/admin.guard.js';
import { BancoPlataforma } from './admin/banco-plataforma.js';
import { AvisosController } from './avisos/avisos.controller.js';
import { DesempenhoService } from './desempenho/desempenho.service.js';
import { BotController } from './bot/bot.controller.js';
import { BotService } from './bot/bot.service.js';
import { provedorWhatsApp } from './whatsapp/provedor.js';
import { WebhooksController } from './whatsapp/webhooks.controller.js';
import { AlertaConexaoService } from './whatsapp/alerta-conexao.service.js';
import { DespesasController } from './despesas/despesas.controller.js';
import { ResumoController } from './resumo/resumo.controller.js';
import { ResumoService } from './resumo/resumo.service.js';
import { MeController } from './me/me.controller.js';
import { ResultadosController } from './resultados/resultados.controller.js';
import { ResultadosService } from './resultados/resultados.service.js';
import { ClientesController } from './clientes/clientes.controller.js';
import { ComandasController } from './comandas/comandas.controller.js';
import { ComandasService } from './comandas/comandas.service.js';
import { ContaController } from './conta/conta.controller.js';
import { ConversasController } from './conversas/conversas.controller.js';
import { ConversasService } from './conversas/conversas.service.js';
import { ProdutosController } from './produtos/produtos.controller.js';
import { ProfissionaisController } from './profissionais/profissionais.controller.js';
import { ProfissionaisService } from './profissionais/profissionais.service.js';
import { ServicosController } from './servicos/servicos.controller.js';
import { UsuariosService } from './usuarios/usuarios.service.js';
import { UsuariosController } from './usuarios/usuarios.controller.js';

/** Serviços que todo módulo de negócio usa. */
@Global()
@Module({
  providers: [
    BancoService,
    EmailsService,
    {
      provide: TokensAcesso,
      inject: [CONFIGURACAO],
      useFactory: (c: Configuracao) => new TokensAcesso(c.jwtSegredo, c.acessoExpiraEmS),
    },
  ],
  exports: [BancoService, EmailsService, TokensAcesso],
})
export class ComumModule {}

@Module({
  imports: [
    ConfiguracaoModule,
    LoggerModule.forRootAsync({
      inject: [CONFIGURACAO],
      useFactory: (c: Configuracao) => ({
        pinoHttp: {
          level: c.nivelLog,
          // O id já foi definido pelo middleware de contexto (vem do X-Request-Id ou é novo).
          genReqId: (req) => (req as { id?: string }).id ?? '',
          customProps: () => {
            const u = Contexto.atual()?.usuario;
            return u ? { usuarioId: u.id, contaId: u.contaId } : {};
          },
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-pente-fino-assinatura"]',
            'req.headers["asaas-access-token"]',
            'res.headers["set-cookie"]',
          ],
          autoLogging: { ignore: (req) => req.url === '/health' },
          transport:
            c.ambiente === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
                }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [CONFIGURACAO],
      useFactory: (c: Configuracao) => ({ throttlers: limitesDeRequisicao(c) }),
    }),
    FilasModule,
    ComumModule,
  ],
  controllers: [
    RaizController,
    AuthController,
    ContaController,
    UsuariosController,
    UnidadesController,
    ServicosController,
    ProfissionaisController,
    ProdutosController,
    ClientesController,
    AgendaController,
    ComandasController,
    CaixaController,
    DespesasController,
    ResultadosController,
    ComissoesController,
    DesempenhoController,
    OcupacaoController,
    RedeController,
    SistemaController,
    AdminAuthController,
    AdminController,
    AdminConfigController,
    AdminNotaFiscalController,
    AdminGestaoController,
    AvisosController,
    ResumoController,
    BotController,
    ConversasController,
    WebhooksController,
    WebhookAsaasController,
    MeController,
    AssistenteController,
    PushController,
    ClubeOnlineController,
    ClubePublicoController,
    ClubeController,
    EsperaController,
    ConfiguracaoController,
    ImportacaoController,
    ExportacaoController,
    PublicoController,
    HorarioPublicoController,
    SaudeController,
  ],
  providers: [
    AuthService,
    BloqueioLogin,
    ClubeOnlineService,
    LimiteCadastro,
    EmailConfirmadoGuard,
    ConvitesService,
    UsuariosService,
    ProfissionaisService,
    ComandasService,
    AgendaService,
    ResultadosService,
    ComissoesService,
    DesempenhoService,
    ResumoService,
    BancoPlataforma,
    AdminAuthService,
    AdminContasService,
    AdminVendasService,
    PrecosService,
    SaudeService,
    AdminGuard,
    BotService,
    AlertaConexaoService,
    ConversasService,
    CobrancaService,
    provedorCobranca,
    provedorWhatsApp,
    // Ordem das guardas: limite de requisições → login → papel e unidade.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_GUARD, useClass: PermissaoGuard },
    // Depois do papel: conta só para consulta não grava (402).
    AssinaturaGuard,
    { provide: APP_GUARD, useExisting: AssinaturaGuard },
    // Recursos por plano (@ExigeRecurso).
    PlanoGuard,
    { provide: APP_GUARD, useExisting: PlanoGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
    { provide: APP_FILTER, useClass: FiltroErros },
  ],
})
export class AppModule {}

import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuditoriaInterceptor } from './auditoria/auditoria.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
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
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
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
  controllers: [RaizController, AuthController, UsuariosController, UnidadesController, SaudeController],
  providers: [
    AuthService,
    ConvitesService,
    // Ordem das guardas: limite de requisições → login → papel e unidade.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AutenticacaoGuard },
    { provide: APP_GUARD, useClass: PermissaoGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
    { provide: APP_FILTER, useClass: FiltroErros },
  ],
})
export class AppModule {}

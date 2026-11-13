import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { normalizarIp } from '@pente-fino/shared';
import { Contexto } from './comum/contexto.js';
import { CONFIGURACAO, type Configuracao } from './config/configuracao.js';

const ID_VALIDO = /^[\w-]{8,64}$/;

/**
 * Abre o contexto da requisição antes de tudo (inclusive do log): o id vem do
 * X-Request-Id do Caddy, se válido, ou é gerado aqui, e volta no cabeçalho da resposta.
 */
function contextoDaRequisicao(req: Request, res: Response, next: NextFunction): void {
  const recebido = req.get('x-request-id');
  const requestId = recebido && ID_VALIDO.test(recebido) ? recebido : randomUUID();
  (req as Request & { id: string }).id = requestId;
  res.setHeader('x-request-id', requestId);
  Contexto.executar(
    {
      requestId,
      ip: normalizarIp(req.ip) ?? undefined,
      userAgent: req.get('user-agent')?.slice(0, 300),
      auditorias: 0,
    },
    next,
  );
}

/** Configuração comum à subida real (main.ts) e aos testes e2e. */
export function configurarApp(app: INestApplication): Configuracao {
  const config = app.get<Configuracao>(CONFIGURACAO);
  const express = app as NestExpressApplication;

  express.useLogger(app.get(Logger));
  express.disable('x-powered-by');
  express.set('trust proxy', config.trustProxy ? 1 : false);
  express.use(contextoDaRequisicao);
  // Até 1 MB, como a ponte do painel: a foto do site (lote 7c) chega reduzida, em base64.
  express.useBodyParser('json', { limit: '1mb' });
  express.enableCors({ origin: config.appUrl, credentials: true });
  express.enableShutdownHooks();

  if (config.apiDocs) {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Pente Fino API')
        .setDescription(
          'API do Pente Fino. Erros sempre no formato { erro: { codigo, mensagem, campos? }, requestId }.',
        )
        .setVersion('0.0.1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, documento);
  }
  return config;
}

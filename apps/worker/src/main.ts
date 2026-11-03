import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { WorkerModule } from './worker.module.js';

// Em desenvolvimento o .env fica na raiz do monorepo; em produção as variáveis vêm do Docker.
const envDaRaiz = new URL('../../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

// Sem servidor HTTP: só os consumidores das filas do BullMQ.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker iniciado, consumindo as filas "emails" e "eventos".');
}
await bootstrap();

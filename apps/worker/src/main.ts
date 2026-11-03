import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

// Sem servidor HTTP: só o contexto de injeção de dependência.
// As filas do BullMQ (bot e rotinas) entram aqui nas próximas etapas.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker iniciado, aguardando tarefas.');
}
await bootstrap();

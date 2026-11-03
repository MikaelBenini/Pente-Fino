import { Module } from '@nestjs/common';
import { CONFIGURACAO_WORKER, carregarConfiguracaoWorker } from './config.js';
import { EmailsProcessor } from './emails.processor.js';
import { EventosProcessor } from './eventos.processor.js';

@Module({
  providers: [
    { provide: CONFIGURACAO_WORKER, useFactory: () => carregarConfiguracaoWorker() },
    EmailsProcessor,
    EventosProcessor,
  ],
})
export class WorkerModule {}

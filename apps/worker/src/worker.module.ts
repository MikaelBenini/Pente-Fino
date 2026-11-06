import { Module } from '@nestjs/common';
import { CONFIGURACAO_WORKER, carregarConfiguracaoWorker } from './config.js';
import { EmailsProcessor } from './emails.processor.js';
import { EventosProcessor } from './eventos.processor.js';
import { NotificacoesProcessor } from './notificacoes.processor.js';
import { Banco } from './banco.js';
import { WhatsappProcessor } from './whatsapp.processor.js';

@Module({
  providers: [
    { provide: CONFIGURACAO_WORKER, useFactory: () => carregarConfiguracaoWorker() },
    EmailsProcessor,
    EventosProcessor,
    NotificacoesProcessor,
    Banco,
    WhatsappProcessor,
  ],
})
export class WorkerModule {}

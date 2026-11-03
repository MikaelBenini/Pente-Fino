import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

// Mantém o processo vivo até as filas do BullMQ assumirem esse papel.
@Injectable()
export class SinalVitalService implements OnApplicationShutdown {
  private readonly logger = new Logger(SinalVitalService.name);
  private readonly intervalo = setInterval(() => undefined, 60_000);

  estaAtivo(): boolean {
    return this.intervalo.hasRef();
  }

  onApplicationShutdown(sinal?: string) {
    clearInterval(this.intervalo);
    this.logger.log(`Worker encerrado${sinal ? ` (${sinal})` : ''}.`);
  }
}

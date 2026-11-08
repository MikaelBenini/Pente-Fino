// Limite de cadastros pelo site por IP (Etapa 15.4), no Redis: 3 por hora e 10 por dia (padrão;
// CADASTRO_LIMITE_POR_HORA e CADASTRO_LIMITE_POR_DIA no .env).
// Sem Redis, não limita (o limite por minuto das rotas de autenticação continua valendo).
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { ErroApp } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { REDIS } from '../filas/filas.module.js';

@Injectable()
export class LimiteCadastro {
  private readonly logger = new Logger(LimiteCadastro.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  /** Conta este cadastro e recusa (429) se o IP passou do limite. */
  async conferir(ip: string | undefined): Promise<void> {
    if (!ip) return;
    const h = createHash('sha256').update(ip).digest('hex').slice(0, 24);
    let passou = false;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      for (const [janela, segundos, limite] of [
        ['h', 3600, this.config.cadastro.limitePorHora],
        ['d', 86_400, this.config.cadastro.limitePorDia],
      ] as const) {
        const chave = `cadastro:${janela}:${h}`;
        const n = await this.redis.incr(chave);
        if (n === 1) await this.redis.expire(chave, segundos);
        if (n > limite) passou = true;
      }
    } catch (e) {
      this.logger.warn(`Limite de cadastro sem Redis: ${(e as Error).message}`);
      return;
    }
    if (passou)
      throw new ErroApp(
        HttpStatus.TOO_MANY_REQUESTS,
        'muitos_cadastros',
        'Muitas contas criadas desta conexão. Tente de novo mais tarde ou fale com a gente.',
      );
  }
}

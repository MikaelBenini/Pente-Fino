// Bloqueio temporário depois de senhas erradas seguidas (Etapa 21), por e-mail, no Redis.
// Complementa o limite por minuto (por IP + e-mail): quem troca de IP também para aqui.
// Sem Redis, não bloqueia (o login segue funcionando; o limite por minuto continua valendo).
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import { ErroApp } from '../comum/erros.js';
import { REDIS } from '../filas/filas.module.js';

/** Senhas erradas seguidas que bloqueiam. */
export const FALHAS_PARA_BLOQUEAR = 5;
/** Janela das falhas e duração do bloqueio. */
export const BLOQUEIO_S = 15 * 60;

@Injectable()
export class BloqueioLogin {
  private readonly logger = new Logger(BloqueioLogin.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private chave(escopo: string, email: string) {
    const h = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
    return { falhas: `login:${escopo}:falhas:${h}`, bloqueio: `login:${escopo}:bloqueio:${h}` };
  }

  private async seguro<T>(f: () => Promise<T>, padrao: T): Promise<T> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return await f();
    } catch (e) {
      this.logger.warn(`Bloqueio de login sem Redis: ${(e as Error).message}`);
      return padrao;
    }
  }

  /** Recusa na hora (429) se o e-mail está bloqueado, sem conferir a senha. */
  async conferir(escopo: 'app' | 'admin', email: string): Promise<void> {
    const k = this.chave(escopo, email);
    const resta = await this.seguro(() => this.redis.ttl(k.bloqueio), -2);
    if (resta > 0) {
      const min = Math.max(1, Math.ceil(resta / 60));
      throw new ErroApp(
        HttpStatus.TOO_MANY_REQUESTS,
        'login_bloqueado',
        `Muitas senhas erradas. Tente de novo em ${min} minuto${min > 1 ? 's' : ''} ou use "Esqueci minha senha".`,
      );
    }
  }

  /** Conta uma senha errada; na quinta seguida, bloqueia por 15 minutos. */
  async falhou(escopo: 'app' | 'admin', email: string): Promise<void> {
    const k = this.chave(escopo, email);
    await this.seguro(async () => {
      const n = await this.redis.incr(k.falhas);
      if (n === 1) await this.redis.expire(k.falhas, BLOQUEIO_S);
      if (n >= FALHAS_PARA_BLOQUEAR) {
        await this.redis.multi().set(k.bloqueio, '1', 'EX', BLOQUEIO_S).del(k.falhas).exec();
      }
    }, undefined);
  }

  /** Entrou: zera a contagem. */
  async acertou(escopo: 'app' | 'admin', email: string): Promise<void> {
    const k = this.chave(escopo, email);
    await this.seguro(() => this.redis.del(k.falhas), 0);
  }
}

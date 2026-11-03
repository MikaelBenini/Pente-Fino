import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { Publico } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { REDIS } from '../filas/filas.module.js';

type Estado = 'ok' | 'erro';

function comPrazo(p: Promise<unknown>, ms = 2_000): Promise<Estado> {
  return Promise.race([
    p.then(() => 'ok' as const),
    new Promise<Estado>((resolve) => setTimeout(() => resolve('erro'), ms).unref()),
  ]).catch(() => 'erro' as const);
}

@ApiTags('Saúde')
@Controller('health')
export class SaudeController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @Publico()
  @SkipThrottle()
  @ApiOperation({ summary: 'Banco e Redis respondendo? 200 se sim, 503 se não' })
  async verificar(@Res({ passthrough: true }) res: Response) {
    const [banco, redis] = await Promise.all([
      comPrazo(this.banco.prisma.$queryRaw`SELECT 1`),
      comPrazo(this.pingRedis()),
    ]);
    const ok = banco === 'ok' && redis === 'ok';
    res.status(ok ? 200 : 503);
    return { status: ok ? 'ok' : 'erro', banco, redis };
  }

  private async pingRedis(): Promise<void> {
    if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
    if ((await this.redis.ping()) !== 'PONG') throw new Error('Redis não respondeu PONG');
  }
}

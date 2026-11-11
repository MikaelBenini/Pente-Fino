// W3: chamadas aos webhooks públicos (Asaas e WhatsApp) com o segredo errado. Ficam guardadas no
// Redis (contagem por dia e as 20 últimas, com IP e horário) para a Saúde do sistema mostrar
// quem está tentando. O IP que errar demais leva 429 por 10 minutos: o Asaas e a Evolution
// nunca erram o segredo, então o limite não pega neles. Sem Redis, só registra no log.
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { dataLocal, normalizarIp } from '@pente-fino/shared';
import type { Redis } from 'ioredis';
import { ErroApp } from './erros.js';
import { REDIS } from '../filas/filas.module.js';

export const LIMITE_RECUSAS_POR_IP = 20;
const JANELA_IP_S = 600;
const ULTIMOS = 'webhook:recusados:ultimos';
const porDia = (dia: string) => `webhook:recusados:${dia}`;
const porIp = (ip: string) => `webhook:falhas:${ip}`;

export interface ResumoRecusas {
  total7Dias: number;
  ultimos: { rota: string; ip: string | null; quando: string }[];
}

@Injectable()
export class WebhooksRecusados {
  private readonly logger = new Logger('Webhooks');

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private async pronto(): Promise<boolean> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return true;
    } catch {
      return false;
    }
  }

  /** Antes de conferir o segredo: o IP que errou demais nos últimos 10 min leva 429. */
  async conferirIp(ipBruto: string | undefined): Promise<void> {
    const ip = normalizarIp(ipBruto);
    if (!ip || !(await this.pronto())) return;
    const n = Number(await this.redis.get(porIp(ip)).catch(() => null));
    if (n >= LIMITE_RECUSAS_POR_IP)
      throw new ErroApp(
        HttpStatus.TOO_MANY_REQUESTS,
        'muitas_tentativas',
        'Muitas tentativas com o segredo errado. Aguarde e tente de novo.',
      );
  }

  /** Segredo errado: registra (log, contagem do dia, últimas) e conta para o limite do IP. */
  async registrar(rota: 'asaas' | 'whatsapp', ipBruto: string | undefined): Promise<void> {
    const ip = normalizarIp(ipBruto) ?? null;
    this.logger.warn(`Webhook ${rota} recusado (segredo errado) de ${ip ?? 'IP desconhecido'}`);
    if (!(await this.pronto())) return;
    const quando = new Date();
    try {
      const dia = porDia(dataLocal(quando));
      await this.redis
        .multi()
        .incr(dia)
        .expire(dia, 8 * 86_400)
        .lpush(ULTIMOS, JSON.stringify({ rota, ip, quando: quando.toISOString() }))
        .ltrim(ULTIMOS, 0, 19)
        .exec();
      if (ip) {
        const n = await this.redis.incr(porIp(ip));
        if (n === 1) await this.redis.expire(porIp(ip), JANELA_IP_S);
      }
    } catch (e) {
      this.logger.warn(`Registrar a recusa sem Redis: ${(e as Error).message}`);
    }
  }

  /** Para a Saúde do sistema: total dos últimos 7 dias e as últimas recusas. */
  async resumo(agora = new Date()): Promise<ResumoRecusas> {
    if (!(await this.pronto())) return { total7Dias: 0, ultimos: [] };
    try {
      const dias = Array.from({ length: 7 }, (_, i) =>
        porDia(dataLocal(new Date(agora.getTime() - i * 86_400_000))),
      );
      const contagens = await this.redis.mget(...dias);
      const ultimos = (await this.redis.lrange(ULTIMOS, 0, 19)).flatMap((t) => {
        try {
          return [JSON.parse(t) as ResumoRecusas['ultimos'][number]];
        } catch {
          return [];
        }
      });
      return { total7Dias: contagens.reduce((s, c) => s + Number(c ?? 0), 0), ultimos };
    } catch {
      return { total7Dias: 0, ultimos: [] };
    }
  }
}

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { ClubeOnlineService } from '../clube/clube-online.service.js';
import { CobrancaService, type NotaWebhook, type PagamentoWebhook } from './cobranca.service.js';

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Webhook do Asaas: confere o token do cabeçalho asaas-access-token (o mesmo cadastrado no
 * Asaas) e aplica a cobrança. Responde 200 mesmo para o que ignora: com erro, o Asaas pausa
 * a fila de avisos da conta inteira.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhookAsaasController {
  private readonly log = new Logger('Webhook Asaas');

  constructor(
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(CobrancaService) private readonly cobranca: CobrancaService,
    @Inject(ClubeOnlineService) private readonly clube: ClubeOnlineService,
  ) {}

  @Post('asaas')
  @Publico()
  @SkipThrottle({ padrao: true })
  @HttpCode(HttpStatus.OK)
  async asaas(
    @Body() corpo: { event?: string; payment?: PagamentoWebhook; invoice?: NotaWebhook },
    @Headers('asaas-access-token') token: string | undefined,
  ): Promise<{ ok: true; resultado: string }> {
    const esperado = this.config.cobranca.webhookToken;
    if (!esperado || !token || !iguais(token, esperado))
      throw Erros.naoAutenticado('Token do webhook inválido.');
    // Nota fiscal da mensalidade (INVOICE_*): o objeto vem em "invoice", não em "payment".
    const nota = corpo?.invoice;
    if (corpo?.event?.startsWith('INVOICE_') && nota?.id) {
      try {
        return { ok: true, resultado: await this.cobranca.webhookNota(corpo.event, nota) };
      } catch (e) {
        this.log.error(`Falhou ao aplicar ${corpo.event} (${nota.id}): ${(e as Error).message}`);
        return { ok: true, resultado: 'erro' };
      }
    }
    const p = corpo?.payment;
    if (!corpo?.event || !p?.id || !p.customer) return { ok: true, resultado: 'ignorado' };
    try {
      // Mensalidade do clube online (assinatura de cliente de barbearia, com split).
      const contaClube = p.subscription ? await this.clube.contaDaAssinatura(p.subscription) : null;
      if (contaClube)
        return { ok: true, resultado: await this.clube.webhook(contaClube, corpo.event, p) };
      return { ok: true, resultado: await this.cobranca.webhook(corpo.event, p) };
    } catch (e) {
      // Registra e responde 200: o "conferir" da tela recupera o que faltar.
      this.log.error(`Falhou ao aplicar ${corpo.event} (${p.id}): ${(e as Error).message}`);
      return { ok: true, resultado: 'erro' };
    }
  }
}

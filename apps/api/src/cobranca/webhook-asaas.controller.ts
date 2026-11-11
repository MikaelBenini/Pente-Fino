import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import { Publico } from '../auth/decoradores.js';
import { Erros } from '../comum/erros.js';
import { WebhooksRecusados } from '../comum/webhooks-recusados.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { ClubeOnlineService } from '../clube/clube-online.service.js';
import { CobrancaService } from './cobranca.service.js';
import {
  PROVEDOR_COBRANCA,
  type NotaWebhook,
  type PagamentoWebhook,
  type ProvedorCobranca,
} from './provedor.js';

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Webhook do Asaas: confere o token do cabeçalho asaas-access-token (o mesmo cadastrado no
 * Asaas) e aplica a cobrança. Do corpo só usa o evento e o id: a cobrança e a nota são buscadas
 * no próprio Asaas (segurança W1), então nem com o token vazado dá para inventar pagamento,
 * valor ou repasse. Responde 200 mesmo para o que ignora: com erro, o Asaas pausa a fila de
 * avisos da conta inteira.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhookAsaasController {
  private readonly log = new Logger('Webhook Asaas');

  constructor(
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(CobrancaService) private readonly cobranca: CobrancaService,
    @Inject(ClubeOnlineService) private readonly clube: ClubeOnlineService,
    @Inject(PROVEDOR_COBRANCA) private readonly provedor: ProvedorCobranca,
    @Inject(WebhooksRecusados) private readonly recusas: WebhooksRecusados,
  ) {}

  @Post('asaas')
  @Publico()
  @SkipThrottle({ padrao: true })
  @HttpCode(HttpStatus.OK)
  async asaas(
    @Body() corpo: { event?: string; payment?: PagamentoWebhook; invoice?: NotaWebhook },
    @Headers('asaas-access-token') token: string | undefined,
    @Ip() ip: string | undefined,
  ): Promise<{ ok: true; resultado: string }> {
    await this.recusas.conferirIp(ip);
    const esperado = this.config.cobranca.webhookToken;
    if (!esperado || !token || !iguais(token, esperado)) {
      await this.recusas.registrar('asaas', ip);
      throw Erros.naoAutenticado('Token do webhook inválido.');
    }
    // Nota fiscal da mensalidade (INVOICE_*): o objeto vem em "invoice", não em "payment".
    const notaId = typeof corpo?.invoice?.id === 'string' ? corpo.invoice.id : null;
    if (corpo?.event?.startsWith('INVOICE_') && notaId) {
      try {
        const nota = await this.provedor.nota(notaId);
        if (!nota?.id) return { ok: true, resultado: 'ignorado' };
        // A situação vem do status atual da nota no Asaas, não do nome do evento recebido.
        return { ok: true, resultado: await this.cobranca.webhookNota('INVOICE_UPDATED', nota) };
      } catch (e) {
        this.log.error(`Falhou ao aplicar ${corpo.event} (${notaId}): ${(e as Error).message}`);
        return { ok: true, resultado: 'erro' };
      }
    }
    const pagamentoId = typeof corpo?.payment?.id === 'string' ? corpo.payment.id : null;
    if (!corpo?.event || !pagamentoId) return { ok: true, resultado: 'ignorado' };
    try {
      const p = await this.provedor.pagamento(pagamentoId);
      if (!p?.id || !p.customer) return { ok: true, resultado: 'ignorado' };
      // Mensalidade do clube online (assinatura de cliente de barbearia, com split).
      const contaClube = p.subscription ? await this.clube.contaDaAssinatura(p.subscription) : null;
      if (contaClube)
        return { ok: true, resultado: await this.clube.webhook(contaClube, corpo.event, p) };
      return { ok: true, resultado: await this.cobranca.webhook(corpo.event, p) };
    } catch (e) {
      // Registra e responde 200: o "conferir" da tela recupera o que faltar.
      this.log.error(`Falhou ao aplicar ${corpo.event} (${pagamentoId}): ${(e as Error).message}`);
      return { ok: true, resultado: 'erro' };
    }
  }
}

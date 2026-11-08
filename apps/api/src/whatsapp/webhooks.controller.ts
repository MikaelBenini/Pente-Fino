import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { conexaoDaInstancia, registrarEstadoConexao } from '@pente-fino/db';
import {
  assinaturaValida,
  CABECALHO_ASSINATURA,
  instanciaDoWebhook,
  lerWebhookEvolution,
} from '@pente-fino/whatsapp';
import { Publico } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Erros } from '../comum/erros.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { Filas } from '../filas/filas.module.js';
import { AlertaConexaoService } from './alerta-conexao.service.js';

/**
 * Webhook da Evolution API. Confere a assinatura da instância (enviada pela própria
 * Evolution, configurada ao conectar) e responde rápido: mensagem vai para a fila do
 * worker; mudança de conexão é gravada na hora, para o painel ver.
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(Filas) private readonly filas: Filas,
    @Inject(AlertaConexaoService) private readonly alerta: AlertaConexaoService,
  ) {}

  @Post('whatsapp')
  @Publico()
  // Todas as unidades chegam do mesmo IP (a Evolution): o limite por IP não se aplica.
  @SkipThrottle({ padrao: true })
  @HttpCode(HttpStatus.OK)
  async whatsapp(
    @Body() corpo: unknown,
    @Headers(CABECALHO_ASSINATURA) assinatura: string | undefined,
  ): Promise<{ ok: true }> {
    const instancia = instanciaDoWebhook(corpo);
    if (!instancia || !assinaturaValida(this.config.whatsapp.webhookSegredo, instancia, assinatura))
      throw Erros.naoAutenticado('Assinatura do webhook inválida.');
    const evento = lerWebhookEvolution(corpo);
    if (!evento) return { ok: true };
    if (evento.tipo === 'mensagem') {
      // Mesmo id = mesmo trabalho: a fila ignora a repetida enquanto a original existir.
      const jobId = `${instancia}_${evento.idExterno}`.replace(/[^\w-]/g, '_');
      await this.filas.whatsappEntrada.add('mensagem', evento, { jobId });
      return { ok: true };
    }
    const conexao = await conexaoDaInstancia(this.banco.prisma, instancia);
    if (conexao) {
      const agora = new Date();
      const linha = await this.banco.naConta(conexao.contaId, (tx) =>
        registrarEstadoConexao(tx, conexao.unidadeId, evento, agora),
      );
      if (this.alerta.caiuAgora(linha, agora))
        await this.alerta.avisar(conexao.contaId, conexao.unidadeId, agora);
    }
    return { ok: true };
  }
}

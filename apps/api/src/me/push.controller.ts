import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  inscricaoPushSchema,
  removerPushSchema,
  type EstadoPush,
  type InscricaoPushEntrada,
} from '@pente-fino/shared';
import type { z } from 'zod';
import { LivreSemAssinatura, Papeis } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { TODOS } from '../comum/escopo.js';
import { Corpo } from '../comum/validacao.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';
import { Filas } from '../filas/filas.module.js';

/**
 * Notificações no celular (push do PWA), pelo Perfil: cada aparelho liga, desliga e manda um
 * aviso de teste. Quem envia é o worker (fila "notificacoes").
 */
@ApiTags('Área do barbeiro')
@ApiBearerAuth()
@Controller('me/push')
export class PushController {
  constructor(
    @Inject(BancoService) private readonly banco: BancoService,
    @Inject(Filas) private readonly filas: Filas,
    @Inject(CONFIGURACAO) private readonly config: Configuracao,
  ) {}

  private estado(): Promise<EstadoPush> {
    return this.banco.daConta(async (tx) => ({
      chavePublica: this.config.vapidChavePublica,
      aparelhos: await tx.inscricaoPush.count({ where: { usuarioId: Contexto.usuario().id } }),
    }));
  }

  @Get()
  @Papeis(...TODOS)
  @ApiOperation({ summary: 'Chave pública do push e quantos aparelhos estão ligados' })
  ver(): Promise<EstadoPush> {
    return this.estado();
  }

  @Post()
  @Papeis(...TODOS)
  @LivreSemAssinatura()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ligar as notificações neste aparelho' })
  async ligar(@Corpo(inscricaoPushSchema) d: InscricaoPushEntrada): Promise<EstadoPush> {
    if (!this.config.vapidChavePublica)
      throw Erros.conflito('As notificações no celular ainda não estão ligadas no servidor.');
    const usuarioId = Contexto.usuario().id;
    await this.banco.daConta(async (tx) => {
      const ja = await tx.inscricaoPush.findFirst({ where: { endpoint: d.endpoint } });
      const dados = { usuarioId, p256dh: d.keys.p256dh, auth: d.keys.auth };
      if (ja) await tx.inscricaoPush.update({ where: { id: ja.id }, data: dados });
      else await tx.inscricaoPush.create({ data: { endpoint: d.endpoint, ...dados } });
    });
    return this.estado();
  }

  @Post('remover')
  @Papeis(...TODOS)
  @LivreSemAssinatura()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desligar as notificações neste aparelho' })
  async remover(
    @Corpo(removerPushSchema) d: z.infer<typeof removerPushSchema>,
  ): Promise<EstadoPush> {
    await this.banco.daConta((tx) =>
      tx.inscricaoPush.deleteMany({
        where: { endpoint: d.endpoint, usuarioId: Contexto.usuario().id },
      }),
    );
    return this.estado();
  }

  @Post('teste')
  @Papeis(...TODOS)
  @LivreSemAssinatura()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Mandar uma notificação de teste para os aparelhos ligados' })
  async teste(): Promise<{ ok: true }> {
    const u = Contexto.usuario();
    await this.filas.notificacoes.add('push', {
      contaId: u.contaId,
      usuarioId: u.id,
      titulo: 'Notificações ligadas ✅',
      corpo: 'É assim que os avisos da sua agenda vão chegar.',
      url: '/perfil',
      etiqueta: 'teste',
    });
    return { ok: true };
  }
}

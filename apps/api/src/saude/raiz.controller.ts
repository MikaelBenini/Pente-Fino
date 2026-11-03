import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Publico } from '../auth/decoradores.js';
import { CONFIGURACAO, type Configuracao } from '../config/configuracao.js';

/**
 * Quem abre a API no navegador cai na documentação (fora de produção).
 * Em produção, só uma identificação: nada de listar rotas para estranhos.
 */
@ApiExcludeController()
@Controller()
export class RaizController {
  constructor(@Inject(CONFIGURACAO) private readonly config: Configuracao) {}

  @Get()
  @Publico()
  @SkipThrottle()
  raiz(@Res({ passthrough: true }) res: Response) {
    if (this.config.apiDocs) {
      res.redirect(302, 'docs');
      return;
    }
    return { nome: 'Pente Fino API', status: 'ok' };
  }
}

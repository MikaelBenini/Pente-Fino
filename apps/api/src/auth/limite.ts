import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Configuracao } from '../config/configuracao.js';
import { LIMITE_AUTENTICACAO } from './decoradores.js';

function rotaDeAutenticacao(ctx: ExecutionContext): boolean {
  return Reflect.getMetadata(LIMITE_AUTENTICACAO, ctx.getHandler()) === true;
}

/**
 * Dois limites por minuto:
 * - padrao: 300 por IP em qualquer rota;
 * - autenticacao: LIMITE_AUTH_POR_MINUTO por IP + e-mail (ou token) nas rotas de login,
 *   convite e senha, para frear tentativa de senha sem travar a barbearia inteira, que
 *   costuma sair pelo mesmo IP.
 */
export function limitesDeRequisicao(config: Configuracao): ThrottlerOptions[] {
  return [
    { name: 'padrao', ttl: 60_000, limit: 300 },
    {
      name: 'autenticacao',
      ttl: 60_000,
      limit: config.limiteAuthPorMinuto,
      skipIf: (ctx) => !rotaDeAutenticacao(ctx),
      getTracker: (req: Record<string, unknown>) => {
        const r = req as unknown as Request;
        const corpo = (r.body ?? {}) as Record<string, unknown>;
        const chave = [corpo.email, corpo.token, corpo.refreshToken, corpo.telefone].find(
          (v) => typeof v === 'string',
        ) as string | undefined;
        return `${r.ip}|${(chave ?? '').toLowerCase().slice(0, 64)}`;
      },
    },
  ];
}

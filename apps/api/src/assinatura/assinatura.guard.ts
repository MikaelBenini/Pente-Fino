import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { estadoAssinatura } from '@pente-fino/db';
import type { EstadoAssinatura } from '@pente-fino/shared';
import type { Request } from 'express';
import { LIVRE_SEM_ASSINATURA } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';

/** Quanto tempo a situação de uma conta fica guardada antes de consultar de novo. */
const VALIDADE_MS = 15_000;
const LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Bloqueio suave da assinatura: com o teste terminado, fatura vencida além da tolerância ou
 * conta suspensa, toda gravação responde 402 com a explicação; ler continua livre e nada é
 * apagado. Rotas marcadas com @LivreSemAssinatura() (sair, senha, pagar) passam.
 */
@Injectable()
export class AssinaturaGuard implements CanActivate {
  private readonly guardadas = new Map<string, { ate: number; estado: EstadoAssinatura }>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(BancoService) private readonly banco: BancoService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const usuario = Contexto.atual()?.usuario;
    if (!usuario) return true; // rota pública
    if (LEITURA.has(ctx.switchToHttp().getRequest<Request>().method)) return true;
    const livre = this.reflector.getAllAndOverride<boolean>(LIVRE_SEM_ASSINATURA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (livre) return true;
    const estado = await this.estado(usuario.contaId);
    if (estado.somenteLeitura) throw Erros.somenteLeitura(estado.mensagem);
    return true;
  }

  private async estado(contaId: string): Promise<EstadoAssinatura> {
    const agora = Date.now();
    const guardada = this.guardadas.get(contaId);
    if (guardada && guardada.ate > agora) return guardada.estado;
    const estado = await this.banco.daConta((tx) => estadoAssinatura(tx));
    this.guardadas.set(contaId, { ate: agora + VALIDADE_MS, estado });
    return estado;
  }

  /** Depois de um pagamento (ou mudança feita pela administração), vale na hora. */
  esquecer(contaId: string): void {
    this.guardadas.delete(contaId);
  }
}

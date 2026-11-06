import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { temRecurso, textoRecursoBloqueado, type PlanoConta } from '@pente-fino/shared';
import type { Request } from 'express';
import { RECURSO_DO_PLANO, type ExigenciaDePlano } from '../auth/decoradores.js';
import { BancoService } from '../comum/banco.service.js';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';

const VALIDADE_MS = 15_000;
const LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Recursos por plano (@ExigeRecurso): sem o plano, 403 "recurso_do_plano" com o convite. */
@Injectable()
export class PlanoGuard implements CanActivate {
  private readonly guardados = new Map<string, { ate: number; plano: PlanoConta }>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(BancoService) private readonly banco: BancoService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const usuario = Contexto.atual()?.usuario;
    if (!usuario) return true; // rota pública: confere no próprio controlador
    const exige = this.reflector.getAllAndOverride<ExigenciaDePlano | undefined>(RECURSO_DO_PLANO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!exige) return true;
    if (exige.soEscrita && LEITURA.has(ctx.switchToHttp().getRequest<Request>().method))
      return true;
    const plano = await this.plano(usuario.contaId);
    if (!temRecurso(plano, exige.recurso))
      throw Erros.recursoDoPlano(textoRecursoBloqueado(exige.recurso, plano));
    return true;
  }

  async plano(contaId: string): Promise<PlanoConta> {
    const agora = Date.now();
    const guardado = this.guardados.get(contaId);
    if (guardado && guardado.ate > agora) return guardado.plano;
    const conta = await this.banco.daConta((tx) =>
      tx.conta.findFirstOrThrow({ select: { plano: true } }),
    );
    this.guardados.set(contaId, { ate: agora + VALIDADE_MS, plano: conta.plano });
    return conta.plano;
  }

  /** Depois de trocar de plano, vale na hora. */
  esquecer(contaId: string): void {
    this.guardados.delete(contaId);
  }
}

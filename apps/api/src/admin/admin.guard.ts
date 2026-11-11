import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { normalizarIp, type PapelPlataforma } from '@pente-fino/shared';
import type { Request } from 'express';
import { Erros } from '../comum/erros.js';
import { AdminAuthService, type AdminAutenticado } from './admin-auth.service.js';

const PAPEIS_PLATAFORMA_ACEITOS = 'papeis_plataforma_aceitos';
/** Quem da plataforma usa a rota (padrão: admin e vendedor). */
export const PapeisPlataforma = (...papeis: PapelPlataforma[]) =>
  SetMetadata(PAPEIS_PLATAFORMA_ACEITOS, papeis);

type ComAdmin = Request & { admin?: AdminAutenticado };

/** Quem está na administração (já conferido pela AdminGuard). */
export const AdminAtual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AdminAutenticado =>
    ctx.switchToHttp().getRequest<ComAdmin>().admin!,
);

/**
 * IP de quem chamou (com TRUST_PROXY, o do cliente atrás do Caddy; a ponte /admin-api do web
 * repassa o X-Forwarded-For que o Caddy montou). Um só jeito de ler, para o login e a auditoria.
 */
export const IpDaRequisicao = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    normalizarIp(ctx.switchToHttp().getRequest<Request>().ip),
);

/**
 * Rotas /admin: sessão da plataforma (token opaco no cabeçalho Authorization: Bearer), nunca o
 * login de uma barbearia. As rotas são @Publico() para a guarda das barbearias, e esta confere.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ComAdmin>();
    const [tipo, token] = (req.get('authorization') ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw Erros.naoAutenticado();
    const admin = await this.auth.sessao(token);
    if (!admin) throw Erros.naoAutenticado('Sua sessão da administração expirou. Entre de novo.');
    const aceitos = this.reflector.getAllAndOverride<PapelPlataforma[] | undefined>(
      PAPEIS_PLATAFORMA_ACEITOS,
      [ctx.getHandler(), ctx.getClass()],
    ) ?? ['admin', 'vendedor'];
    if (!aceitos.includes(admin.papel)) throw Erros.semPermissao();
    req.admin = admin;
    return true;
  }
}

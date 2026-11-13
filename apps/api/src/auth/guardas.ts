import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { podeNaUnidade, temAlgumPapel, type Papel } from '@pente-fino/shared';
import type { Request } from 'express';
import { Contexto } from '../comum/contexto.js';
import { Erros } from '../comum/erros.js';
import { PAPEIS_ACEITOS, ROTA_PUBLICA } from './decoradores.js';
import { TokensAcesso } from './tokens.js';

/** Toda rota exige token de acesso válido, exceto as marcadas com @Publico(). */
@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TokensAcesso) private readonly tokens: TokensAcesso,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publica) return true;

    const cabecalho = ctx.switchToHttp().getRequest<Request>().get('authorization') ?? '';
    const [tipo, token] = cabecalho.split(' ');
    if (tipo !== 'Bearer' || !token) throw Erros.naoAutenticado();

    const usuario = await this.tokens.verificar(token);
    if (!usuario) throw Erros.naoAutenticado('Sua sessão expirou. Entre de novo.');

    const contexto = Contexto.atual();
    if (!contexto) throw new Error('ContextoMiddleware não rodou antes da guarda');
    contexto.usuario = usuario;
    if (usuario.suporte) exigirLeituraDeSuporte(ctx.switchToHttp().getRequest<Request>());
    return true;
  }
}

/**
 * Admin F5: a sessão de suporte só lê. Gravação é recusada, e as conversas do bot ficam
 * fechadas (o texto dos clientes pode ter telefone e assunto pessoal).
 */
function exigirLeituraDeSuporte(req: Request): void {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    throw Erros.semPermissao('Modo suporte: só leitura. Nada pode ser gravado nesta sessão.');
  if (/^\/(api\/)?conversas(\/|$|\?)/.test(req.path ?? req.url))
    throw Erros.semPermissao('Modo suporte: as conversas do bot ficam fechadas.');
}

/** Unidade alvo da requisição: parâmetro de rota, query ou corpo. */
function unidadeDaRequisicao(req: Request): string | null {
  const candidatos = [
    req.params?.unidadeId,
    req.query?.unidadeId,
    (req.body as { unidadeId?: unknown })?.unidadeId,
  ];
  const achado = candidatos.find((v) => typeof v === 'string' && v.length > 0);
  return (achado as string | undefined) ?? null;
}

/**
 * Papéis aceitos (@Papeis) e unidade. Com unidadeId na requisição, o papel precisa
 * valer nela; sem, basta ter o papel em alguma unidade (o serviço filtra os dados).
 */
@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const usuario = Contexto.atual()?.usuario;
    if (!usuario) return true; // rota pública

    const aceitos = this.reflector.getAllAndOverride<Papel[] | undefined>(PAPEIS_ACEITOS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const unidadeId = unidadeDaRequisicao(ctx.switchToHttp().getRequest<Request>());
    const papeis: readonly Papel[] = aceitos ?? ['dono', 'gestor', 'recepcao', 'barbeiro'];

    const permitido = unidadeId
      ? podeNaUnidade(usuario.papeis, unidadeId, papeis)
      : temAlgumPapel(usuario.papeis, papeis);
    if (!permitido) throw Erros.semPermissao();
    return true;
  }
}

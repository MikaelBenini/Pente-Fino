import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma, Transacao } from '@pente-fino/db';
import { type Observable, tap } from 'rxjs';
import { Contexto } from '../comum/contexto.js';

export interface RegistroAuditoria {
  entidade: string;
  entidadeId: string;
  acao: string;
  antes?: unknown;
  depois?: unknown;
  motivo?: string;
}

const CAMPOS_SENSIVEIS = /senha|token|hash|secret/i;

/** Remove campos sensíveis (senha, tokens) antes de gravar o antes/depois. */
export function limparSensiveis(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(limparSensiveis);
  if (valor instanceof Date) return valor.toISOString();
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [
        k,
        CAMPOS_SENSIVEIS.test(k) ? '[omitido]' : limparSensiveis(v),
      ]),
    );
  }
  return valor;
}

/**
 * Grava a auditoria na mesma transação da alteração: ou as duas ficam, ou nenhuma.
 * O autor vem do contexto (usuário autenticado) ou de `usuarioId` (ex.: aceite de convite).
 */
export async function auditar(
  tx: Transacao,
  r: RegistroAuditoria,
  usuarioId?: string,
): Promise<void> {
  const contexto = Contexto.atual();
  await tx.auditoria.create({
    data: {
      usuarioId: usuarioId ?? contexto?.usuario?.id ?? null,
      entidade: r.entidade,
      entidadeId: r.entidadeId,
      acao: r.acao,
      antes: (limparSensiveis(r.antes) ?? undefined) as Prisma.InputJsonValue | undefined,
      depois: (limparSensiveis(r.depois) ?? undefined) as Prisma.InputJsonValue | undefined,
      motivo: r.motivo ?? null,
    },
  });
  if (contexto) contexto.auditorias += 1;
}

const ROTA_AUDITADA = 'rota_auditada';
/** Marca uma rota que altera dado sensível: ela precisa gravar auditoria ao dar certo. */
export const Auditada = () => SetMetadata(ROTA_AUDITADA, true);

/**
 * Confere que toda rota @Auditada() gravou auditoria (via auditar()) quando deu certo.
 * Em desenvolvimento e teste, esquecer é erro; em produção, vira alerta no log.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Auditoria');

  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.reflector.get<boolean>(ROTA_AUDITADA, ctx.getHandler())) return next.handle();
    return next.handle().pipe(
      tap(() => {
        if ((Contexto.atual()?.auditorias ?? 0) > 0) return;
        const rota = `${ctx.getClass().name}.${ctx.getHandler().name}`;
        if (process.env.NODE_ENV === 'production')
          this.logger.error(`Rota auditada sem auditoria: ${rota}`);
        else throw new Error(`Rota @Auditada() terminou sem gravar auditoria: ${rota}`);
      }),
    );
  }
}

import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { PapelAtribuido, Papel } from '@pente-fino/shared';
import type { UsuarioAutenticado } from '../comum/contexto.js';

const EMISSOR = 'pente-fino';
const PUBLICO = 'pente-fino-api';

/** Token opaco (renovação, convite, redefinição): 256 bits aleatórios em base64url. */
export function gerarTokenOpaco(): string {
  return randomBytes(32).toString('base64url');
}

/** Só o hash vai para o banco: vazamento do banco não entrega tokens válidos. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface Carga {
  conta: string;
  papeis: { p: Papel; u: string | null }[];
  /** Admin F5: sessão de suporte (quem da equipe e até quando), só leitura. */
  sup?: { n: string; ate: string };
}

export class TokensAcesso {
  private readonly chave: Uint8Array;

  constructor(
    segredo: string,
    private readonly expiraEmS: number,
  ) {
    this.chave = new TextEncoder().encode(segredo);
  }

  /** JWT curto com conta e papéis: a API não consulta o banco para autorizar cada requisição. */
  emitir(usuario: UsuarioAutenticado): Promise<string> {
    const carga: Carga = {
      conta: usuario.contaId,
      papeis: usuario.papeis.map((p) => ({ p: p.papel, u: p.unidadeId })),
    };
    return new SignJWT({ ...carga })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(usuario.id)
      .setIssuer(EMISSOR)
      .setAudience(PUBLICO)
      .setIssuedAt()
      .setExpirationTime(`${this.expiraEmS}s`)
      .sign(this.chave);
  }

  /**
   * Admin F5: sessão de suporte na conta, como dono e só leitura (a guarda recusa gravação).
   * `sub` é o id da pessoa da equipe; vale até `ate` (no máximo 1 h, nunca depois do dono).
   */
  emitirSuporte(contaId: string, admin: { id: string; nome: string }, ate: Date): Promise<string> {
    const carga: Carga = {
      conta: contaId,
      papeis: [{ p: 'dono', u: null }],
      sup: { n: admin.nome, ate: ate.toISOString() },
    };
    return new SignJWT({ ...carga })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(admin.id)
      .setIssuer(EMISSOR)
      .setAudience(PUBLICO)
      .setIssuedAt()
      .setExpirationTime(Math.floor(ate.getTime() / 1000))
      .sign(this.chave);
  }

  /** Devolve o usuário ou null se o token for inválido, expirado ou adulterado. */
  async verificar(token: string): Promise<UsuarioAutenticado | null> {
    try {
      const { payload } = await jwtVerify<Carga>(token, this.chave, {
        issuer: EMISSOR,
        audience: PUBLICO,
        algorithms: ['HS256'],
      });
      if (!payload.sub || typeof payload.conta !== 'string' || !Array.isArray(payload.papeis))
        return null;
      const papeis: PapelAtribuido[] = payload.papeis.map((p) => ({ papel: p.p, unidadeId: p.u }));
      const sup = payload.sup;
      return {
        id: payload.sub,
        contaId: payload.conta,
        papeis,
        ...(sup && typeof sup.n === 'string' && typeof sup.ate === 'string'
          ? { suporte: { adminId: payload.sub, nome: sup.n, ate: sup.ate } }
          : {}),
      };
    } catch {
      return null;
    }
  }
}

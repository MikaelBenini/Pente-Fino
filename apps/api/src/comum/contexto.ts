// Contexto da requisição (AsyncLocalStorage): id da requisição, usuário autenticado
// e registros de auditoria. Definido pelo ContextoMiddleware e pela guarda de autenticação.
import type { PapelAtribuido } from '@pente-fino/shared';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface UsuarioAutenticado {
  id: string;
  contaId: string;
  papeis: PapelAtribuido[];
}

export interface DadosContexto {
  requestId: string;
  ip?: string;
  userAgent?: string;
  usuario?: UsuarioAutenticado;
  /** Quantos registros de auditoria esta requisição gravou (conferido pelo interceptor). */
  auditorias: number;
}

const armazenamento = new AsyncLocalStorage<DadosContexto>();

export const Contexto = {
  executar<T>(dados: DadosContexto, fn: () => T): T {
    return armazenamento.run(dados, fn);
  },
  atual(): DadosContexto | undefined {
    return armazenamento.getStore();
  },
  /** Usuário autenticado; lança se a rota não passou pela guarda de autenticação. */
  usuario(): UsuarioAutenticado {
    const usuario = armazenamento.getStore()?.usuario;
    if (!usuario) throw new Error('Contexto sem usuário autenticado (rota pública?)');
    return usuario;
  },
};

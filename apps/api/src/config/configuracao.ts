// Configuração validada na subida: variável faltando ou inválida = a API não sobe.
import { duracaoEmMs } from '@pente-fino/shared';
import { z } from 'zod';

const booleano = z
  .enum(['true', 'false', '1', '0', ''])
  .transform((v) => v === 'true' || v === '1');

const duracao = z.string().refine(
  (v) => {
    try {
      duracaoEmMs(v);
      return true;
    } catch {
      return false;
    }
  },
  { error: 'use 45s, 15m, 12h ou 30d' },
);

const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.url(),
    API_URL: z.url(),
    DATABASE_URL: z.string().startsWith('postgresql://'),
    REDIS_URL: z.string().startsWith('redis://'),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: duracao.default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: duracao.default('30d'),
    /** Documentação OpenAPI em /docs. Padrão: ligada fora de produção (homologação liga à mão). */
    API_DOCS: booleano.optional(),
    /** Atrás do Caddy: confia no X-Forwarded-For para saber o IP real. */
    TRUST_PROXY: booleano.default(false),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Tentativas por minuto nas rotas de login, convite e senha (por IP + e-mail ou token). */
    LIMITE_AUTH_POR_MINUTO: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_ACCESS_SECRET.includes('troque')) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message: 'em produção use um valor aleatório com 32+ caracteres (openssl rand -base64 48)',
      });
    }
  });

export interface Configuracao {
  ambiente: 'development' | 'test' | 'production';
  porta: number;
  appUrl: string;
  apiUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwtSegredo: string;
  /** Validade do token de acesso, em segundos. */
  acessoExpiraEmS: number;
  /** Validade do token de renovação, em milissegundos. */
  renovacaoExpiraEmMs: number;
  apiDocs: boolean;
  trustProxy: boolean;
  nivelLog: string;
  limiteAuthPorMinuto: number;
}

export const CONFIGURACAO = Symbol('CONFIGURACAO');

export class ConfiguracaoInvalidaError extends Error {}

/** Lê e valida as variáveis de ambiente. Lança erro com a lista em português. */
export function carregarConfiguracao(env: NodeJS.ProcessEnv = process.env): Configuracao {
  const r = esquema.safeParse(env);
  if (!r.success) {
    const linhas = r.error.issues.map((i) => `  - ${i.path.join('.') || '(geral)'}: ${i.message}`);
    throw new ConfiguracaoInvalidaError(
      `Configuração inválida. Confira o .env (modelo em .env.example):\n${linhas.join('\n')}`,
    );
  }
  const e = r.data;
  return {
    ambiente: e.NODE_ENV,
    porta: e.API_PORT,
    appUrl: e.APP_URL.replace(/\/$/, ''),
    apiUrl: e.API_URL.replace(/\/$/, ''),
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    jwtSegredo: e.JWT_ACCESS_SECRET,
    acessoExpiraEmS: duracaoEmMs(e.JWT_ACCESS_EXPIRES_IN) / 1000,
    renovacaoExpiraEmMs: duracaoEmMs(e.REFRESH_TOKEN_EXPIRES_IN),
    apiDocs: e.API_DOCS ?? e.NODE_ENV !== 'production',
    trustProxy: e.TRUST_PROXY,
    nivelLog: e.LOG_LEVEL,
    limiteAuthPorMinuto: e.LIMITE_AUTH_POR_MINUTO,
  };
}

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
    /** Requisições por minuto por IP em qualquer rota (o teste de carga sobe este número). */
    LIMITE_POR_MINUTO: z.coerce.number().int().positive().default(300),
    /** evolution = Evolution API de verdade; falso = sem WhatsApp (testes e tela sem celular). */
    WHATSAPP_PROVEDOR: z.enum(['evolution', 'falso']).default('evolution'),
    EVOLUTION_API_URL: z.url().default('http://localhost:8080'),
    EVOLUTION_API_KEY: z.string().default(''),
    /** Assina o webhook de cada instância (a Evolution devolve no cabeçalho). */
    WHATSAPP_WEBHOOK_SEGREDO: z.string().min(16),
    /** Endereço da API visto pela Evolution. Padrão: API_URL/webhooks/whatsapp. */
    WHATSAPP_WEBHOOK_URL: z.url().optional(),
    /** asaas = cobrança de verdade (sandbox ou produção); falso = sem Asaas (testes). */
    COBRANCA_PROVEDOR: z.enum(['asaas', 'falso']).default('asaas'),
    ASAAS_API_URL: z.url().default('https://api-sandbox.asaas.com/v3'),
    ASAAS_API_KEY: z.string().default(''),
    /** Token que o Asaas manda no cabeçalho asaas-access-token de cada webhook. */
    ASAAS_WEBHOOK_TOKEN: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(16).optional(),
    ),
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
    if (
      env.WHATSAPP_WEBHOOK_SEGREDO.length < 32 ||
      env.WHATSAPP_WEBHOOK_SEGREDO.includes('troque')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['WHATSAPP_WEBHOOK_SEGREDO'],
        message: 'em produção use um valor aleatório com 32+ caracteres (openssl rand -hex 32)',
      });
    }
    if (env.COBRANCA_PROVEDOR === 'asaas') {
      if (!env.ASAAS_API_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['ASAAS_API_KEY'],
          message: 'defina a chave do Asaas',
        });
      if (!env.ASAAS_WEBHOOK_TOKEN)
        ctx.addIssue({
          code: 'custom',
          path: ['ASAAS_WEBHOOK_TOKEN'],
          message: 'defina o token do webhook (o mesmo cadastrado no Asaas)',
        });
    }
    if (env.WHATSAPP_PROVEDOR === 'evolution' && !env.EVOLUTION_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['EVOLUTION_API_KEY'],
        message: 'defina a chave da Evolution API',
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
  limitePorMinuto: number;
  whatsapp: {
    provedor: 'evolution' | 'falso';
    evolutionUrl: string;
    evolutionChave: string;
    webhookSegredo: string;
    webhookUrl: string;
  };
  cobranca: {
    provedor: 'asaas' | 'falso';
    asaasUrl: string;
    asaasChave: string;
    /** null: webhook desligado (dev sem endereço público; use "conferir pagamento"). */
    webhookToken: string | null;
  };
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
    limitePorMinuto: e.LIMITE_POR_MINUTO,
    whatsapp: {
      provedor: e.WHATSAPP_PROVEDOR,
      evolutionUrl: e.EVOLUTION_API_URL.replace(/\/$/, ''),
      evolutionChave: e.EVOLUTION_API_KEY,
      webhookSegredo: e.WHATSAPP_WEBHOOK_SEGREDO,
      webhookUrl: e.WHATSAPP_WEBHOOK_URL ?? `${e.API_URL.replace(/\/$/, '')}/webhooks/whatsapp`,
    },
    cobranca: {
      provedor: e.COBRANCA_PROVEDOR,
      asaasUrl: e.ASAAS_API_URL.replace(/\/$/, ''),
      asaasChave: e.ASAAS_API_KEY,
      webhookToken: e.ASAAS_WEBHOOK_TOKEN ?? null,
    },
  };
}

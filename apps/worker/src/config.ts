// Configuração do worker, validada na subida.
import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().startsWith('redis://'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  EMAIL_FROM: z.string().min(3),
});

export type ConfiguracaoWorker = z.infer<typeof esquema>;
export const CONFIGURACAO_WORKER = Symbol('CONFIGURACAO_WORKER');

export function carregarConfiguracaoWorker(
  env: NodeJS.ProcessEnv = process.env,
): ConfiguracaoWorker {
  const r = esquema.safeParse(env);
  if (!r.success) {
    const linhas = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Configuração do worker inválida. Confira o .env:\n${linhas.join('\n')}`);
  }
  return r.data;
}

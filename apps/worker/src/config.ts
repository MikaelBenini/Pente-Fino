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
  /** Decifra a senha do SMTP configurado na administração; sem ela, só vale o SMTP do .env. */
  PLATAFORMA_CHAVE: z
    .string()
    .default('')
    .refine((v) => v === '' || Buffer.from(v, 'base64').length === 32, {
      error: 'precisa de 32 bytes em base64',
    }),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  /** Endereço do painel, para o link de agendamento nas respostas do bot. */
  APP_URL: z.url().transform((u) => u.replace(/\/$/, '')),
  WHATSAPP_PROVEDOR: z.enum(['evolution', 'falso']).default('evolution'),
  EVOLUTION_API_URL: z.url().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default(''),
  /** Push do PWA; sem as chaves, as notificações no celular ficam desligadas. */
  VAPID_CHAVE_PUBLICA: z.string().default(''),
  VAPID_CHAVE_PRIVADA: z.string().default(''),
  VAPID_CONTATO: z.string().default('mailto:suporte@pentefino.dev'),
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

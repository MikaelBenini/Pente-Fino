// Configuração do Prisma CLI (migrações, seed e geração do cliente).
// As migrações rodam como o dono do banco (DATABASE_MIGRATION_URL), nunca como o
// usuário da aplicação.
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

const envDaRaiz = new URL('../../.env', import.meta.url);
if (existsSync(envDaRaiz)) process.loadEnvFile(envDaRaiz);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_MIGRATION_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});

import { defineConfig } from 'vitest/config';

// Testes de unidade: não precisam de banco. Os de banco (*.db.test.ts) rodam com
// pnpm test:db (vitest.db.config.ts), com o PostgreSQL do docker-compose no ar.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.db.test.ts'],
  },
});

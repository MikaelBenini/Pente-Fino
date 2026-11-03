import { defineConfig } from 'vitest/config';

// Testes contra o PostgreSQL real (pnpm infra:up + pnpm db:deploy antes).
export default defineConfig({
  test: {
    include: ['test/**/*.db.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Um arquivo por vez: os testes criam e apagam contas próprias.
    fileParallelism: false,
  },
});

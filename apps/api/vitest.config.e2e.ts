import { defineConfig } from 'vitest/config';

// Testes de ponta a ponta: API inteira contra PostgreSQL e Redis reais
// (pnpm infra:up e pnpm db:deploy antes).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/ambiente.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});

import { defineConfig } from 'vitest/config';

// As regras de cálculo vivem aqui: cobertura mínima de 80% (linha de desenvolvimento, Etapa 7).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      reporter: ['text-summary', 'text'],
    },
  },
});

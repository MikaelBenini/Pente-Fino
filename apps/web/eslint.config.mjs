import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Sobras da gravação do vídeo (fora do Git).
    'video-tmp/**',
    // Rastros dos testes de tela (Playwright, fora do Git).
    'test-results/**',
    'playwright-report/**',
  ]),
]);

export default eslintConfig;

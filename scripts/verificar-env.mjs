// Confere se o .env existe e tem todas as variáveis do .env.example.
// Roda antes de subir a infraestrutura (pnpm infra:up / pnpm dev).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const caminhoEnv = join(raiz, '.env');
const caminhoExemplo = join(raiz, '.env.example');

/** @param {string} texto */
function chaves(texto) {
  return new Set(
    texto
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha && !linha.startsWith('#') && linha.includes('='))
      .map((linha) => linha.slice(0, linha.indexOf('=')).trim()),
  );
}

if (!existsSync(caminhoEnv)) {
  console.error('Arquivo .env não encontrado.');
  console.error('Crie a partir do modelo:  cp .env.example .env');
  process.exit(1);
}

const esperadas = chaves(readFileSync(caminhoExemplo, 'utf8'));
const presentes = chaves(readFileSync(caminhoEnv, 'utf8'));
const faltando = [...esperadas].filter((chave) => !presentes.has(chave));

if (faltando.length > 0) {
  console.error('Faltam variáveis no .env (veja os valores no .env.example):');
  for (const chave of faltando) console.error(`  - ${chave}`);
  process.exit(1);
}

console.log('.env ok');

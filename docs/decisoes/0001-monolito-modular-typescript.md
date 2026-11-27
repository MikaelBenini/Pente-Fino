# 0001 · Monólito modular em TypeScript

- **Status:** Aceita
- **Data:** 2026-11-03

## Contexto

Time pequeno, produto com muitas regras compartilhadas entre painel, app do barbeiro, bot e rotinas.

## Decisão

Um monorepo pnpm + Turborepo, TypeScript strict: `apps/web` (Next.js, também o PWA do barbeiro), `apps/api` (NestJS, módulos por domínio), `apps/worker` (NestJS sem HTTP, filas BullMQ) e pacotes compartilhados (`db`, `shared`, `ui`, `whatsapp`).

## Consequências

Um só lugar para tipos e regras; deploy simples. O worker separado evita que mensagem e e-mail travem o clique. Escala vertical numa VPS até precisar separar o banco.

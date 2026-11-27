# Pente Fino: instruções para agentes de IA

Este arquivo é o ponto de entrada para ferramentas que leem `AGENTS.md` (Codex, Cursor, Copilot
e outras). As regras completas ficam em [`docs/CLAUDE.md`](docs/CLAUDE.md): leia antes de mudar
qualquer coisa. O Claude Code carrega o mesmo arquivo pelo `CLAUDE.md` da raiz.

## Por onde começar

1. [`docs/CLAUDE.md`](docs/CLAUDE.md): stack, comandos, regras de negócio que não podem quebrar e
   convenções.
2. [`docs/README.md`](docs/README.md): mapa da documentação (visão geral, arquitetura, modelo de
   dados, regras com exemplos, fluxos, permissões, glossário e decisões).
3. [`docs/a-fazer.md`](docs/a-fazer.md): o que está em andamento e o próximo passo.

## O essencial

- Monorepo pnpm + Turborepo, TypeScript strict: `apps/web` (Next.js), `apps/api` (NestJS),
  `apps/worker` (NestJS + BullMQ), `packages/db` (Prisma + PostgreSQL com RLS), `packages/shared`
  (zod e regras de cálculo), `packages/ui`, `packages/whatsapp`.
- Código e nomes de domínio em português; textos da interface em pt-BR.
- Multiempresa: toda consulta de negócio dentro de `naConta()`; nunca confiar em `conta_id` vindo
  do cliente.
- Dinheiro em centavos (inteiro); datas em UTC no banco, exibição em `America/Sao_Paulo`.
- Regra de cálculo nova vai para `packages/shared`, com teste, antes da tela.
- Verificação antes de abrir PR: `pnpm lint`, `pnpm typecheck`, `pnpm test --concurrency=1`,
  `pnpm test:db`, `pnpm test:e2e`, `pnpm build` e `pnpm docs:conferir`.
- A parte da documentação que sai do código (`docs/gerado/`) é refeita com `pnpm docs:gerar`.

O `apps/web/AGENTS.md` (escrito pelo Next.js) avisa que a versão do Next usada aqui tem mudanças
em relação ao que os modelos conhecem: consulte `node_modules/next/dist/docs/` antes de mexer no
front-end.

# Pente Fino

Sistema de gestão para barbearias: painel web, app do barbeiro (PWA) e bot de WhatsApp sem IA.
**Saiba quanto sobra, não só quanto entrou.**

## Rodar o projeto em 3 comandos

Requisitos: Node.js 24 (veja `.nvmrc`) e Git.

```bash
corepack enable          # ativa o pnpm na versão do package.json
pnpm install             # instala tudo e liga os hooks de commit
pnpm dev                 # sobe web, API e worker
```

- Painel: http://localhost:3000
- API: http://localhost:3001

Antes do primeiro `pnpm dev`, copie `.env.example` para `.env`. A partir da Etapa 2, o `pnpm dev` também precisa do Docker rodando (`infra/docker-compose.dev.yml`).

> No Windows, se `corepack enable` der erro de permissão, rode
> `corepack enable --install-directory "$env:APPDATA\npm" pnpm` no PowerShell.

## Desenvolver no GitHub Codespaces

Recomendado quando a máquina não roda Docker (sem WSL2 ou Hyper-V). O Codespace é um Linux com Docker, igual à VPS de produção.

1. No GitHub: **Code → Codespaces → Create codespace** na branch desejada.
2. Espere o `pos-criacao.sh` terminar (instala o pnpm e as dependências e cria o `.env`).
3. Rode `pnpm dev`. As portas 3000 (web) e 3001 (API) abrem no navegador pela aba **Portas**.

Para poupar a cota gratuita: pare o Codespace quando terminar e ajuste o tempo de inatividade em **Settings → Codespaces**.

## Comandos

| Comando          | O que faz                                     |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Sobe todos os apps em modo de desenvolvimento |
| `pnpm build`     | Gera o build de todos os pacotes              |
| `pnpm lint`      | ESLint em todos os pacotes                    |
| `pnpm typecheck` | Checagem de tipos (TypeScript `strict`)       |
| `pnpm test`      | Testes (Vitest)                               |
| `pnpm format`    | Formata o código com Prettier                 |

Para rodar só um pacote: `pnpm --filter @pente-fino/api dev`.

## Estrutura

```text
apps/
  web/       Next.js: painel, app do barbeiro (PWA), TV, link de agendamento
  api/       NestJS: regras, permissões, auditoria
  worker/    NestJS sem HTTP: bot do WhatsApp e rotinas agendadas
packages/
  db/        Prisma: schema, migrações, políticas RLS, seed
  shared/    tipos, validações (zod) e regras de cálculo
  ui/        componentes e tema
infra/       docker-compose, Caddyfile, scripts de backup e deploy
docs/        documentação do produto e linha de desenvolvimento
```

## Como trabalhar

- Uma branch por tarefa (`feat/comanda-fechar`, `fix/caixa-divergencia`), pull request e merge com squash.
- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `chore:`). O hook `commit-msg` recusa mensagens fora do padrão.
- O hook `pre-commit` roda ESLint e Prettier nos arquivos alterados.
- Toda regra de cálculo nova vai para `packages/shared` com teste unitário antes da tela.

## Documentação

- [Documentação do produto](docs/documentacao-do-produto.md): PRD, TRD, fluxos, UI/UX, esquema, plano e preços
- [Linha de desenvolvimento](docs/linha-de-desenvolvimento.md): etapas, da pasta à VPS

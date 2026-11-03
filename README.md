# Pente Fino

Sistema de gestão para barbearias: painel web, app do barbeiro (PWA) e bot de WhatsApp sem IA.
**Saiba quanto sobra, não só quanto entrou.**

## Rodar o projeto em 3 comandos

Requisitos: Node.js 24 (veja `.nvmrc`), Git e Docker com Compose. Sem Docker na máquina, use o [Codespaces](#desenvolver-no-github-codespaces).

```bash
corepack enable && pnpm install   # pnpm + dependências + hooks de commit
cp .env.example .env              # variáveis de desenvolvimento
pnpm dev                          # sobe banco, Redis, Evolution API, Mailpit, web, API e worker
```

| Serviço                  | Endereço                      |
| ------------------------ | ----------------------------- |
| Painel                   | http://localhost:3000         |
| API                      | http://localhost:3001         |
| Evolution API (WhatsApp) | http://localhost:8080/manager |
| Mailpit (e-mails)        | http://localhost:8025         |
| PostgreSQL               | localhost:5432                |
| Redis                    | localhost:6379                |

Para conferir se a infraestrutura está saudável: `pnpm infra:verificar`.

### Conectar o WhatsApp de teste

1. Abra http://localhost:8080/manager e entre com a `EVOLUTION_API_KEY` do `.env`.
2. Crie uma instância (ex.: `teste`) do tipo Baileys.
3. No celular do chip de teste: WhatsApp → Aparelhos conectados → Conectar aparelho, e leia o QR Code.

A sessão fica salva no volume `evolution_instancias`; não precisa ler o QR de novo ao reiniciar.

> No Windows, se `corepack enable` der erro de permissão, rode
> `corepack enable --install-directory "$env:APPDATA\npm" pnpm` no PowerShell.

## Desenvolver no GitHub Codespaces

Recomendado quando a máquina não roda Docker (sem WSL2 ou Hyper-V). O Codespace é um Linux com Docker, igual à VPS de produção.

1. No GitHub: **Code → Codespaces → Create codespace** na branch desejada.
2. Espere o `pos-criacao.sh` terminar (instala o pnpm e as dependências e cria o `.env`).


Para poupar a cota gratuita: pare o Codespace quando terminar e ajuste o tempo de inatividade em **Settings → Codespaces**.

## Comandos

| Comando                | O que faz                                                      |
| ---------------------- | -------------------------------------------------------------- |
| `pnpm dev`             | Sobe a infraestrutura (Docker) e todos os apps                 |
| `pnpm dev:apps`        | Só os apps, sem mexer no Docker                                |
| `pnpm infra:up`        | Sobe PostgreSQL, Redis, Evolution API e Mailpit                |
| `pnpm infra:down`      | Para a infraestrutura (mantém os dados)                        |
| `pnpm infra:reset`     | Para e **apaga** os dados (banco, sessão do WhatsApp, e-mails) |
| `pnpm infra:logs`      | Acompanha os logs dos containers                               |
| `pnpm infra:verificar` | Testa banco, permissões, Redis, Evolution API e Mailpit        |
| `pnpm db:migrate`      | Aplica as migrações do banco (a partir da Etapa 3)             |
| `pnpm db:seed`         | Carrega os dados iniciais (a partir da Etapa 3)                |
| `pnpm build`           | Gera o build de todos os pacotes                               |
| `pnpm lint`            | ESLint em todos os pacotes                                     |
| `pnpm typecheck`       | Checagem de tipos (TypeScript `strict`)                        |
| `pnpm test`            | Testes (Vitest)                                                |
| `pnpm format`          | Formata o código com Prettier                                  |

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

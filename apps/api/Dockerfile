# syntax=docker/dockerfile:1.7
# API do Pente Fino. Construir na raiz do repositório:
#   docker build -f apps/api/Dockerfile -t pente-fino-api .
#   docker build -f apps/api/Dockerfile --target migracoes -t pente-fino-migracoes .
# A imagem final roda sem root e leva só as dependências de produção da API.

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Só os pacotes que a API usa (turbo prune), com o lockfile podado.
FROM base AS poda
COPY . .
RUN npx -y turbo@2.11.10 prune @pente-fino/api --docker

FROM base AS build
COPY --from=poda /repo/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=poda /repo/out/full/ .
# Configuração do TypeScript da raiz (o prune não leva).
COPY --from=poda /repo/tsconfig.base.json ./
RUN pnpm turbo run build --filter=@pente-fino/api

# Migrações (e pnpm admin:criar): precisa do CLI do Prisma, que é dependência de desenvolvimento.
FROM build AS migracoes
WORKDIR /repo/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM build AS producao
# Instalação nova só com o de produção (a de cima tinha as ferramentas de build).
RUN find . -name node_modules -type d -prune -exec rm -rf {} + \
 && pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS final
ENV NODE_ENV=production
WORKDIR /app
COPY --from=producao --chown=node:node /repo /app
# Pasta das fotos do site (lote 7c): o volume novo herda o dono node na primeira subida.
RUN mkdir -p /dados/fotos && chown node:node /dados/fotos
USER node
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${API_PORT:-3001}/health || exit 1
CMD ["node", "dist/main.js"]

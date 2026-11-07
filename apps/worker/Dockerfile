# syntax=docker/dockerfile:1.7
# Worker do Pente Fino (bot do WhatsApp e rotinas). Construir na raiz do repositório:
#   docker build -f apps/worker/Dockerfile -t pente-fino-worker .
# A imagem final roda sem root e leva só as dependências de produção do worker.

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS poda
COPY . .
RUN npx -y turbo@2.11.10 prune @pente-fino/worker --docker

FROM base AS build
COPY --from=poda /repo/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=poda /repo/out/full/ .
# Configuração do TypeScript da raiz (o prune não leva).
COPY --from=poda /repo/tsconfig.base.json ./
RUN pnpm turbo run build --filter=@pente-fino/worker
# Instalação nova só com o de produção (a de cima tinha as ferramentas de build).
RUN find . -name node_modules -type d -prune -exec rm -rf {} + \
 && pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS final
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /repo /app
USER node
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]

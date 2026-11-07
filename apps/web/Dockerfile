# syntax=docker/dockerfile:1.7
# Painel, app do barbeiro e site (Next.js). Construir na raiz do repositório:
#   docker build -f apps/web/Dockerfile -t pente-fino-web .
# Usa a saída "standalone" do Next: a imagem final leva só o servidor e o que ele importa.

FROM node:25-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS poda
COPY . .
RUN npx -y turbo@2.11.10 prune @pente-fino/web --docker

FROM base AS build
COPY --from=poda /repo/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=poda /repo/out/full/ .
# Configuração do TypeScript da raiz (o prune não leva).
COPY --from=poda /repo/tsconfig.base.json ./
ENV NEXT_STANDALONE=1
RUN pnpm turbo run build --filter=@pente-fino/web

FROM node:25-alpine AS final
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

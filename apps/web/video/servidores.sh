#!/usr/bin/env bash
# Sobe a API (3201) e o site (3200) contra o banco pente_fino_video, sem WhatsApp nem cobrança de
# verdade. Precisa do build (pnpm build). Ctrl+C para os dois.
set -euo pipefail
cd "$(dirname "$0")/../../.."
# Lê só o que precisa do .env (sem carregar o arquivo inteiro: há valores com "$").
ler() { sed -n "s/^$1=//p" .env | tail -1 | sed "s/^['\"]//; s/['\"]\$//"; }
for v in POSTGRES_USER DB_NAME DB_OWNER_USER DB_APP_USER DB_PLATAFORMA_USER DATABASE_URL DATABASE_MIGRATION_URL DATABASE_PLATAFORMA_URL; do
  printf -v "$v" '%s' "$(ler "$v")"
done
V() { echo "$1" | sed "s#/$DB_NAME\$#/pente_fino_video#"; }
export DATABASE_URL=$(V "$DATABASE_URL") DATABASE_MIGRATION_URL=$(V "$DATABASE_MIGRATION_URL") DATABASE_PLATAFORMA_URL=$(V "$DATABASE_PLATAFORMA_URL")
export REDIS_URL=redis://localhost:6379/5 API_PORT=3201 APP_URL=http://localhost:3200 API_URL=http://localhost:3201
export WHATSAPP_PROVEDOR=falso COBRANCA_PROVEDOR=falso LOG_LEVEL=warn LIMITE_AUTH_POR_MINUTO=100
trap 'kill 0' EXIT
(cd apps/api && node dist/main.js) &
(cd apps/web && NODE_ENV=production pnpm exec next start --port 3200) &
wait

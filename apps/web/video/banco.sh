#!/usr/bin/env bash
# Recria o banco pente_fino_video (só a demonstração) para gravar o vídeo sem dados de teste.
# Lê as credenciais do .env da raiz; não imprime nenhuma delas.
set -euo pipefail
cd "$(dirname "$0")/../../.."
# Lê só o que precisa do .env (sem carregar o arquivo inteiro: há valores com "$").
ler() { sed -n "s/^$1=//p" .env | tail -1 | sed "s/^['\"]//; s/['\"]\$//"; }
for v in POSTGRES_USER DB_NAME DB_OWNER_USER DB_APP_USER DB_PLATAFORMA_USER DATABASE_URL DATABASE_MIGRATION_URL DATABASE_PLATAFORMA_URL; do
  printf -v "$v" '%s' "$(ler "$v")"
done
P() { docker exec -i pente-fino-dev-postgres-1 psql -q -U "$POSTGRES_USER" "$@"; }
P -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='pente_fino_video'" >/dev/null
P -d postgres -c "DROP DATABASE IF EXISTS pente_fino_video" \
  -c "CREATE DATABASE pente_fino_video OWNER $DB_OWNER_USER ENCODING 'UTF8' TEMPLATE template0" \
  -c "REVOKE ALL ON DATABASE pente_fino_video FROM PUBLIC" \
  -c "GRANT CONNECT, TEMPORARY ON DATABASE pente_fino_video TO $DB_APP_USER, $DB_PLATAFORMA_USER"
P -d pente_fino_video -c "ALTER SCHEMA public OWNER TO $DB_OWNER_USER" -c "REVOKE ALL ON SCHEMA public FROM PUBLIC"
V() { echo "$1" | sed "s#/$DB_NAME\$#/pente_fino_video#"; }
export DATABASE_URL=$(V "$DATABASE_URL") DATABASE_MIGRATION_URL=$(V "$DATABASE_MIGRATION_URL") DATABASE_PLATAFORMA_URL=$(V "$DATABASE_PLATAFORMA_URL")
cd packages/db && pnpm exec prisma migrate deploy >/dev/null && pnpm exec tsx prisma/seed.ts >/dev/null 2>&1
echo "banco pente_fino_video pronto"

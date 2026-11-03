#!/usr/bin/env bash
# Testa a infraestrutura de desenvolvimento de ponta a ponta.
# Uso: pnpm infra:verificar   (com a infraestrutura no ar: pnpm infra:up)
set -euo pipefail

cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

compose() { docker compose --env-file .env -f infra/docker-compose.dev.yml "$@"; }
psql_como() { compose exec -T -e PGPASSWORD="$2" postgres psql -h 127.0.0.1 -U "$1" -d "$DB_NAME" -v ON_ERROR_STOP=1 -tAc "$3"; }

falhas=0
ok() { echo "  ok    $1"; }
falha() { echo "  FALHA $1"; falhas=$((falhas + 1)); }

echo "PostgreSQL"
if [ "$(psql_como "$DB_APP_USER" "$DB_APP_PASSWORD" "select rolsuper::text || rolbypassrls::text from pg_roles where rolname = current_user")" = "falsefalse" ]; then
  ok "usuário da aplicação não é superusuário nem ignora RLS"
else
  falha "usuário da aplicação tem superusuário ou BYPASSRLS"
fi

if psql_como "$DB_APP_USER" "$DB_APP_PASSWORD" "create table teste_app (id int)" >/dev/null 2>&1; then
  falha "usuário da aplicação conseguiu criar tabela"
  psql_como "$DB_OWNER_USER" "$DB_OWNER_PASSWORD" "drop table if exists teste_app" >/dev/null || true
else
  ok "usuário da aplicação não cria tabelas"
fi

psql_como "$DB_OWNER_USER" "$DB_OWNER_PASSWORD" "drop table if exists teste_permissao; create table teste_permissao (id int)" >/dev/null
if psql_como "$DB_APP_USER" "$DB_APP_PASSWORD" "insert into teste_permissao values (1); select count(*) from teste_permissao" >/dev/null 2>&1; then
  ok "tabela criada pelo dono fica disponível para a aplicação"
else
  falha "aplicação sem acesso a tabela criada pelo dono"
fi
psql_como "$DB_OWNER_USER" "$DB_OWNER_PASSWORD" "drop table teste_permissao" >/dev/null

echo "Redis"
if [ "$(compose exec -T redis redis-cli ping)" = "PONG" ]; then ok "responde ao ping"; else falha "não respondeu"; fi

echo "Evolution API"
if curl -fsS "http://127.0.0.1:${EVOLUTION_PORT:-8080}/" >/dev/null; then ok "no ar"; else falha "fora do ar"; fi
if curl -fsS -H "apikey: ${EVOLUTION_API_KEY}" "http://127.0.0.1:${EVOLUTION_PORT:-8080}/instance/fetchInstances" >/dev/null; then
  ok "aceita a chave do .env"
else
  falha "recusou a chave do .env"
fi

echo "Mailpit"
assunto="verificacao-$(date +%s)"
printf 'From: teste@pentefino.local\r\nTo: dev@pentefino.local\r\nSubject: %s\r\n\r\nteste\r\n' "$assunto" >/tmp/pente-fino-email.txt
if curl -fsS --url "smtp://127.0.0.1:${SMTP_PORT:-1025}" --mail-from teste@pentefino.local --mail-rcpt dev@pentefino.local -T /tmp/pente-fino-email.txt >/dev/null &&
  sleep 1 &&
  curl -fsS "http://127.0.0.1:${MAILPIT_UI_PORT:-8025}/api/v1/search?query=subject:${assunto}" | grep -q "\"messages_count\":1"; then
  ok "recebe e-mail por SMTP"
else
  falha "não recebeu o e-mail de teste"
fi

echo
if [ "$falhas" -gt 0 ]; then
  echo "$falhas verificação(ões) falharam."
  exit 1
fi
echo "Ambiente ok."

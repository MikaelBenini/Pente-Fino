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

# As permissões de dados vêm das migrações, concedidas ao papel pente_fino_aplicacao.
if [ "$(psql_como "$DB_APP_USER" "$DB_APP_PASSWORD" "select pg_has_role(current_user, 'pente_fino_aplicacao', 'member')::text")" = "true" ]; then
  ok "usuário da aplicação é membro de pente_fino_aplicacao"
else
  falha "usuário da aplicação não é membro de pente_fino_aplicacao"
fi

if [ "$(psql_como "$DB_OWNER_USER" "$DB_OWNER_PASSWORD" "select to_regclass('public.conta') is not null")" = "t" ]; then
  # Sem app.conta_id na sessão, o RLS não libera nenhuma linha.
  if [ "$(psql_como "$DB_APP_USER" "$DB_APP_PASSWORD" "select count(*) from conta")" = "0" ]; then
    ok "sem conta na sessão, a aplicação não enxerga nenhuma conta (RLS)"
  else
    falha "aplicação enxerga contas sem app.conta_id definido"
  fi
else
  echo "  info  migrações ainda não aplicadas (rode: pnpm db:deploy)"
fi

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

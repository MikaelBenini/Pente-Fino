#!/usr/bin/env bash
# Restaura um backup do backup.sh (passo a passo em docs/restaurar.md).
#   ./restaurar.sh --teste    [arquivo]   restaura num PostgreSQL descartável e confere (não mexe
#                                        na produção). Sem arquivo: o backup mais recente.
#   ./restaurar.sh --producao  arquivo    APAGA o banco atual e põe o do backup no lugar.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
ler() { sed -n "s/^$1=//p" .env | tail -1 | sed "s/^['\"]//; s/['\"]$//"; }
export BACKUP_SENHA="${BACKUP_SENHA:-$(ler BACKUP_SENHA)}"
BANCO="$(ler DB_NAME)"; BANCO="${BANCO:-pente_fino}"
MODO="${1:-}"
ARQ="${2:-$(ls -1t /opt/barbearia/backups/diario/*.enc 2>/dev/null | head -1)}"
[[ "$MODO" == --teste || "$MODO" == --producao ]] || { sed -n '2,6p' "$0"; exit 1; }
[[ -f "$ARQ" ]] || { echo "Backup não encontrado: $ARQ" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; docker rm -f pente-fino-restauracao >/dev/null 2>&1 || true' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in "$ARQ" | tar xzf - -C "$TMP"
echo "Backup de $(cat "$TMP/quando.txt"): $(ls "$TMP" | tr '\n' ' ')"

restaurar_em() { # container
  docker cp "$TMP/." "$1:/tmp/restauro"
  docker exec "$1" sh -c "psql -q -U postgres -d postgres -f /tmp/restauro/globais.sql >/dev/null 2>&1 || true"
  # --create recria cada banco com o dono e as permissões originais (RLS depende disso).
  for b in "$BANCO" evolution; do
    docker exec "$1" pg_restore -U postgres -d postgres --create --exit-on-error "/tmp/restauro/$b.dump"
  done
  docker exec "$1" rm -rf /tmp/restauro
}

if [[ "$MODO" == --teste ]]; then
  docker run -d --name pente-fino-restauracao -e POSTGRES_PASSWORD=restauro postgres:18-alpine >/dev/null
  until docker exec pente-fino-restauracao pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
  sleep 2
  restaurar_em pente-fino-restauracao
  docker exec pente-fino-restauracao psql -U postgres -d "$BANCO" -tAc \
    "select 'contas: '||count(*) from conta union all select 'usuários: '||count(*) from usuario union all select 'comandas: '||count(*) from comanda union all select 'migrações: '||count(*) from _prisma_migrations union all select 'dono das tabelas: '||tableowner from pg_tables where tablename='conta' union all select 'RLS forçado em conta: '||relforcerowsecurity from pg_class where relname='conta'"
  echo "Restauração de teste ok (o banco descartável foi apagado)."
  exit 0
fi

read -r -p "Isto APAGA o banco de produção e põe o backup no lugar. Digite RESTAURAR: " ok
[[ "$ok" == RESTAURAR ]] || { echo "Cancelado."; exit 1; }
C="docker compose --env-file .env -f docker-compose.prod.yml"
$C stop api worker web evolution
for b in "$BANCO" evolution; do
  docker exec pente-fino-postgres-1 psql -q -U postgres -d postgres -c "DROP DATABASE IF EXISTS \"$b\" WITH (FORCE)"
done
restaurar_em pente-fino-postgres-1
docker run --rm -v pente-fino_evolution_instancias:/dados -v "$TMP":/backup alpine:3.22 \
  sh -c 'rm -rf /dados/* && tar xzf /backup/evolution_instancias.tgz -C /dados'
./atualizar.sh

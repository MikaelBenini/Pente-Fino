#!/usr/bin/env bash
# Backup diário do Pente Fino na VPS (Etapa 18). Agendado pelo cron (ver docs/restaurar.md):
#   ./backup.sh
#
# Guarda, num arquivo só e criptografado (AES-256, senha BACKUP_SENHA do .env):
#   - usuários e permissões do PostgreSQL (pg_dumpall --globals-only)
#   - o banco do sistema e o da Evolution API (pg_dump formato custom)
#   - o volume de sessões da Evolution API (não precisa escanear o QR de novo)
# Retenção local: 30 diários e 12 mensais (o do dia 1º de cada mês). Com BACKUP_DESTINO no .env
# (um remoto do rclone, ex.: "externo:pente-fino-backup", criado pelo backup-externo.sh), os
# arquivos novos vão também para o armazenamento externo.
# Com BACKUP_AVISO_URL (monitor "push" do Uptime Kuma), avisa a cada backup que deu certo: se o
# aviso não chegar no dia, o monitoramento alerta.
set -euo pipefail
cd "$(dirname "$0")"
umask 077

ler() { sed -n "s/^$1=//p" .env | tail -1 | sed "s/^['\"]//; s/['\"]$//"; }
export BACKUP_SENHA="$(ler BACKUP_SENHA)"
DESTINO="$(ler BACKUP_DESTINO)"
AVISO="$(ler BACKUP_AVISO_URL)"
BANCO="$(ler DB_NAME)"; BANCO="${BANCO:-pente_fino}"
[[ -n "$BACKUP_SENHA" ]] || { echo "Falta BACKUP_SENHA no .env (rode ./instalar.sh)." >&2; exit 1; }

PASTA="${BACKUP_PASTA:-/opt/barbearia/backups}"
HOJE="$(date +%F)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$PASTA/diario" "$PASTA/mensal"

pg() { docker exec pente-fino-postgres-1 "$@"; }
# rclone em contêiner (nada a instalar na VPS); a configuração fica em ./rclone (backup-externo.sh).
rclone() {
  docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/rclone:/config/rclone" \
    -v "$PASTA:$PASTA" rclone/rclone:1.68.2 "$@"
}
pg pg_dumpall -U postgres --globals-only > "$TMP/globais.sql"
pg pg_dump -U postgres -Fc "$BANCO" > "$TMP/$BANCO.dump"
pg pg_dump -U postgres -Fc evolution > "$TMP/evolution.dump"
docker run --rm -v pente-fino_evolution_instancias:/dados:ro -v "$TMP":/saida alpine:3.22 \
  tar czf /saida/evolution_instancias.tgz -C /dados .
date -u +%FT%TZ > "$TMP/quando.txt"

ARQ="$PASTA/diario/pente-fino-$HOJE.tar.gz.enc"
tar czf - -C "$TMP" . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass env:BACKUP_SENHA -out "$ARQ"
# Confere se abre antes de apagar os antigos.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in "$ARQ" | tar tzf - >/dev/null

if [[ "$(date +%d)" == "01" ]]; then cp "$ARQ" "$PASTA/mensal/"; fi
manter() { # pasta quantidade: apaga os mais antigos além da quantidade
  find "$1" -maxdepth 1 -name '*.enc' -printf '%T@ %p\n' | sort -rn | tail -n +"$(($2 + 1))" |
    cut -d' ' -f2- | xargs -r rm -f
}
manter "$PASTA/diario" 30
manter "$PASTA/mensal" 12

if [[ -n "$DESTINO" ]]; then
  # copy (não sync): um servidor novo com a pasta vazia nunca apaga o que está lá fora. A
  # retenção do armazenamento externo é por idade, um pouco maior que a local.
  rclone copy "$PASTA" "$DESTINO" --quiet
  rclone delete "$DESTINO/diario" --min-age 35d --quiet || true
  rclone delete "$DESTINO/mensal" --min-age 400d --quiet || true
fi
TAMANHO="$(du -h "$ARQ" | cut -f1)"
echo "$(date '+%F %T') ok $ARQ ($TAMANHO)${DESTINO:+ → $DESTINO}"
if [[ -n "$AVISO" ]]; then
  curl -fsS -m 10 "$AVISO?status=up&msg=ok%20$TAMANHO" >/dev/null || true
fi

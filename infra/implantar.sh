#!/usr/bin/env bash
# Deploy automático (Etapa 17). A chave do GitHub Actions só consegue rodar este script
# (command= no authorized_keys, criado por chave-deploy.sh). O Actions manda o sha do commit:
#   ssh deploy@vps <sha>
# Baixa os arquivos de infra/ daquele commit (repositório público), recarrega o Caddy se o
# Caddyfile mudou e sobe a versão com ./atualizar.sh <sha> (migrações antes da API).
set -euo pipefail
cd /opt/barbearia
# Tudo dentro de uma função: o bash lê o script inteiro antes de rodar, então copiar a versão
# nova deste arquivo por cima dele mesmo (o cp lá embaixo) não embaralha a execução.
principal() {
  SHA="${SSH_ORIGINAL_COMMAND:-${1:-}}"
  [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Envie o sha completo do commit." >&2; exit 2; }
  REPO="${REPO_INFRA:-MikaelBenini/Pente-Fino}"
  exec 9>/tmp/pente-fino-implantar.lock
  flock -w 600 9 || { echo "Outro deploy em andamento." >&2; exit 3; }

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  for f in docker-compose.prod.yml Caddyfile atualizar.sh admin.sh backup.sh restaurar.sh vigia.sh implantar.sh instalar.sh chave-deploy.sh status.sh status-kuma.mjs status.css backup-externo.sh; do
    curl -fsSL -m 30 "https://raw.githubusercontent.com/$REPO/$SHA/infra/$f" -o "$TMP/$f"
  done
  mkdir -p "$TMP/postgres/init"
  for f in 01-bancos-e-usuarios.sh 02-plataforma.sh; do
    curl -fsSL -m 30 "https://raw.githubusercontent.com/$REPO/$SHA/infra/postgres/init/$f" -o "$TMP/postgres/init/$f"
  done
  chmod +x "$TMP"/*.sh "$TMP"/postgres/init/*.sh

  caddy_mudou=0
  cmp -s "$TMP/Caddyfile" Caddyfile || caddy_mudou=1
  # Pasta deixada pelo Docker no lugar de um arquivo que ainda não existia (ex.: status.css).
  for f in "$TMP"/*; do [[ -f "$f" && -d "$(basename "$f")" ]] && { rmdir "$(basename "$f")" 2>/dev/null || true; }; done
  cp -r "$TMP"/. .
  ./atualizar.sh "$SHA"
  docker compose --env-file .env -f docker-compose.prod.yml up -d --remove-orphans caddy status >/dev/null
  if (( caddy_mudou )); then
    docker exec pente-fino-caddy-1 caddy reload --config /etc/caddy/Caddyfile
  fi
  echo "Implantado: $SHA"
}
principal "$@"
exit $?

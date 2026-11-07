#!/usr/bin/env bash
# Cria quem administra o sistema (/admin) ou redefine senha e autenticador, na VPS:
#   ./admin.sh --email voce@email.com --nome "Seu Nome"
#   ./admin.sh --email voce@email.com --redefinir
# A senha aparece uma vez só, aqui no terminal.
set -euo pipefail
cd "$(dirname "$0")"
docker compose --env-file .env -f docker-compose.prod.yml run --rm --no-deps migracoes \
  pnpm exec tsx scripts/admin.ts "$@"

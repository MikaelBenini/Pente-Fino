#!/usr/bin/env bash
# Roda uma vez, quando o Codespace é criado.
set -euo pipefail

corepack enable
pnpm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Criado .env a partir do .env.example"
fi

echo
echo "Pronto. Rode: pnpm dev"

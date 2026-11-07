#!/usr/bin/env bash
# Sobe ou atualiza o Pente Fino na VPS, dentro de /opt/barbearia:
#   ./atualizar.sh            versão gravada no .env (TAG; padrão latest)
#   ./atualizar.sh <sha>      versão de um commit da main (sha completo, como no GitHub)
#   ./atualizar.sh anterior   volta para a versão que estava antes da última atualização
# As migrações rodam antes da API subir (serviço "migracoes"). Migração não se desfaz sozinha:
# voltar uma versão só funciona se o banco novo ainda servir para o código antigo.
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env ]] || { echo "Falta o .env: rode ./instalar.sh primeiro." >&2; exit 1; }

compose() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }
atual="$(sed -n 's/^TAG=//p' .env)"
nova="${1:-$atual}"
if [[ "$nova" == "anterior" ]]; then
  [[ -f .tag-anterior ]] || { echo "Não há versão anterior registrada." >&2; exit 1; }
  nova="$(cat .tag-anterior)"
fi

if [[ "$nova" != "$atual" ]]; then
  printf '%s\n' "$atual" > .tag-anterior
  sed -i "s/^TAG=.*/TAG=$nova/" .env
fi

echo "Versão: $nova"
compose pull --quiet
compose up -d --remove-orphans
# Espera a API e o painel ficarem saudáveis (até 3 minutos).
for _ in $(seq 1 36); do
  if [[ "$(docker inspect -f '{{.State.Health.Status}}' pente-fino-web-1 2>/dev/null)" == healthy ]]; then
    compose ps --format 'table {{.Service}}\t{{.Status}}'
    docker image prune -f >/dev/null
    echo "No ar: versão $nova"
    exit 0
  fi
  sleep 5
done
compose ps --format 'table {{.Service}}\t{{.Status}}'
compose logs --tail 40 migracoes api web
echo "O painel não ficou saudável em 3 minutos. Para voltar: ./atualizar.sh anterior" >&2
exit 1

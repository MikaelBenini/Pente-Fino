#!/usr/bin/env bash
# Vigia da VPS (Etapa 19), pelo cron a cada 5 minutos. Avisa o monitor "push" do Uptime Kuma
# (VIGIA_AVISO_URL no .env): "up" com os números, ou "down" se o disco passar de 80% ou a memória
# de 90%. Se o aviso parar de chegar (servidor travado), o Uptime Kuma também alerta.
# Contêiner com o healthcheck "unhealthy" (por exemplo, o worker travado, V3) é reiniciado aqui:
# o Docker só reinicia sozinho quem sai, não quem trava. O aviso vai como "down" com o nome.
set -euo pipefail
cd "$(dirname "$0")"
URL="$(sed -n 's/^VIGIA_AVISO_URL=//p' .env | tail -1 | tr -d "'\"")"
[[ -n "$URL" ]] || exit 0
disco="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
memoria="$(free | awk '/^Mem:/{printf "%d", ($2-$7)*100/$2}')"
status=up
(( disco > 80 || memoria > 90 )) && status=down
extra=""
doentes="$(docker ps --filter health=unhealthy --format '{{.Names}}' 2>/dev/null || true)"
if [[ -n "$doentes" ]]; then
  for c in $doentes; do docker restart "$c" >/dev/null 2>&1 || true; done
  status=down
  extra="%20reiniciado%20$(echo $doentes | tr ' ' ',')"
fi
curl -fsS -m 10 "$URL?status=$status&msg=disco%20${disco}%25%20memoria%20${memoria}%25${extra}&ping=$memoria" >/dev/null || true

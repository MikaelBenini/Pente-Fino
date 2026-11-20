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
# Verificação final (15/11): o backup diário dependia de alguém pôr a linha no cron à mão, e não
# estava rodando (o Uptime Kuma só recebia os backups manuais). A cada deploy, as duas linhas
# ficam garantidas: backup às 3h de Brasília (antes da limpeza das 3h30) e vigia a cada 5 min.
# Troca as linhas antigas, postas à mão, para não rodar em dobro.
garantir_cron() {
  command -v crontab >/dev/null || { echo "Sem crontab: agende o backup.sh e o vigia.sh à mão." >&2; return 0; }
  mkdir -p /opt/barbearia/backups
  # Hora do servidor que corresponde às 3h em São Paulo (UTC−3), qualquer que seja o fuso dele.
  local deslocamento hora atual
  deslocamento=$(( 10#$(date +%z | cut -c2-3) * $( [[ "$(date +%z | cut -c1)" == "-" ]] && echo -1 || echo 1 ) ))
  hora=$(( ((3 + 3 + deslocamento) % 24 + 24) % 24 ))
  atual="$(crontab -l 2>/dev/null | grep -vE '# pente-fino:|backup\.sh|vigia\.sh' || true)"
  printf '%s\n%s\n%s\n' "$atual" \
    "0 $hora * * * cd /opt/barbearia && ./backup.sh >> /opt/barbearia/backups/backup.log 2>&1 # pente-fino:backup" \
    "*/5 * * * * cd /opt/barbearia && ./vigia.sh >/dev/null 2>&1 # pente-fino:vigia" |
    sed '/^$/d' | crontab -
}

principal() {
  SHA="${SSH_ORIGINAL_COMMAND:-${1:-}}"
  [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Envie o sha completo do commit." >&2; exit 2; }
  REPO="${REPO_INFRA:-MikaelBenini/Pente-Fino}"
  exec 9>/tmp/pente-fino-implantar.lock
  flock -w 600 9 || { echo "Outro deploy em andamento." >&2; exit 3; }

  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  for f in docker-compose.prod.yml Caddyfile atualizar.sh admin.sh backup.sh restaurar.sh vigia.sh implantar.sh instalar.sh chave-deploy.sh status.sh status-kuma.mjs status.css backup-externo.sh diagnostico-backup.sh; do
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
  # O próprio implantar.sh entra por mv (arquivo novo): o bash que está rodando continua lendo o
  # antigo. Copiado por cima, o bash lia a versão nova na posição da antiga e quebrava no fim
  # (20/11/2026: "syntax error near unexpected token do", com tudo já implantado).
  mv -f "$TMP/implantar.sh" ./implantar.sh.novo
  cp -r "$TMP"/. .
  mv -f ./implantar.sh.novo ./implantar.sh
  # Antes da atualização também (20/11/2026): se ela falhar, o set -e parava o script e o cron do
  # backup nunca era posto.
  garantir_cron
  ./atualizar.sh "$SHA"
  garantir_cron
  # O aviso do Compose sobre valor com "$" traria o valor para o log público: sai escondido.
  docker compose --env-file .env -f docker-compose.prod.yml up -d --remove-orphans caddy status >/dev/null \
    2> >(sed -E 's/The \\?"[^"\\]*\\?" variable is not set\. Defaulting to a blank string\./Um valor do .env tem "$" sem aspas simples (valor escondido)./' >&2)
  if (( caddy_mudou )); then
    docker exec pente-fino-caddy-1 caddy reload --config /etc/caddy/Caddyfile
  fi
  echo "Implantado: $SHA"
}
# Na mesma linha: o bash lê a linha inteira antes de rodar, então sai sem ler mais nada do arquivo.
principal "$@"; exit $?

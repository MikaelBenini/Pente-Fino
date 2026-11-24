#!/usr/bin/env bash
# Por que o backup não rodou sozinho? (pedido do dono em 20/11/2026). Na VPS, como deploy:
#   cd /opt/barbearia && ./diagnostico-backup.sh
# Só lê: não muda nada nem mostra segredo (a BACKUP_SENHA aparece só como "definida").
set -uo pipefail
cd "$(dirname "$0")"
ok() { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
ruim() { printf '  \033[31mFALHA\033[0m %s\n' "$*"; }
info() { printf '  ·    %s\n' "$*"; }

echo "1. Relógio"
info "Servidor: $(date '+%F %T %Z') · São Paulo: $(TZ=America/Sao_Paulo date '+%F %T')"

echo "2. Serviço do cron"
if systemctl is-active --quiet cron 2>/dev/null; then ok "cron ativo"; else ruim "cron parado: sudo systemctl enable --now cron"; fi

echo "3. Linhas do backup e do vigia no crontab de $(whoami)"
linhas="$(crontab -l 2>/dev/null || true)"
if grep -q 'backup\.sh' <<<"$linhas"; then ok "$(grep 'backup\.sh' <<<"$linhas")"; else ruim "sem a linha do backup: rode ./implantar.sh <sha> ou faça um deploy"; fi
if grep -q 'vigia\.sh' <<<"$linhas"; then ok "$(grep 'vigia\.sh' <<<"$linhas")"; else ruim "sem a linha do vigia"; fi

echo "4. O cron chegou a chamar? (últimas execuções no log do sistema)"
journalctl -u cron --since '-2 days' --no-pager 2>/dev/null | grep -E 'backup\.sh|vigia\.sh' | tail -5 |
  while read -r l; do info "$l"; done || info "sem acesso ao journalctl"

echo "5. Permissões e ferramentas"
[[ -x ./backup.sh ]] && ok "backup.sh executável" || ruim "backup.sh sem permissão: chmod +x backup.sh"
grep -q '^BACKUP_SENHA=.\+' .env && ok "BACKUP_SENHA definida" || ruim "BACKUP_SENHA vazia no .env"
id -nG | grep -qw docker && ok "$(whoami) está no grupo docker" || ruim "$(whoami) fora do grupo docker: sudo usermod -aG docker $(whoami)"
for b in docker openssl tar flock curl; do command -v "$b" >/dev/null && ok "$b em $(command -v "$b")" || ruim "falta $b"; done
docker ps --format '{{.Names}}' | grep -q '^pente-fino-postgres-1$' && ok "contêiner do banco no ar" || ruim "contêiner pente-fino-postgres-1 não encontrado"
if grep -q '^BACKUP_DESTINO=.\+' .env; then
  if [[ -r rclone/rclone.conf ]]; then ok "cópia externa: configuração do rclone legível"
  else ruim "cópia externa: $(whoami) não lê rclone/rclone.conf (dono: $(stat -c %U rclone 2>/dev/null)). Rode: sudo chown -R $(whoami):$(id -gn) /opt/barbearia/rclone"; fi
else info "sem cópia externa (BACKUP_DESTINO vazio)"; fi

echo "6. Arquivos de backup"
PASTA=/opt/barbearia/backups
ultimo="$(find "$PASTA/diario" -maxdepth 1 -name '*.enc' -printf '%TY-%Tm-%Td %TH:%TM  %s bytes  %f\n' 2>/dev/null | sort | tail -1)"
[[ -n "$ultimo" ]] && info "último: $ultimo" || ruim "nenhum backup em $PASTA/diario"
recente="$(find "$PASTA/diario" -maxdepth 1 -name '*.enc' -mmin -1560 2>/dev/null | head -1)"
[[ -n "$recente" ]] && ok "há backup das últimas 26 h" || ruim "nenhum backup nas últimas 26 h"

echo "7. Fim do backup.log"
tail -n 15 "$PASTA/backup.log" 2>/dev/null | sed 's/^/  │ /' || info "sem backup.log"

echo "8. O que a Saúde do sistema recebeu"
BANCO="$(sed -n 's/^DB_NAME=//p' .env | tail -1 | tr -d "'\"")"; BANCO="${BANCO:-pente_fino}"
docker exec pente-fino-postgres-1 psql -U postgres -d "$BANCO" -Atc \
  "SELECT valor::text, atualizado_em FROM configuracao_plataforma WHERE chave = 'estado_backup'" 2>/dev/null |
  sed 's/^/  │ /' || info "não deu para ler"

echo
echo "Para testar agora, do jeito do cron (ambiente mínimo):"
echo "  env -i HOME=\$HOME PATH=/usr/bin:/bin bash -c 'cd /opt/barbearia && ./backup.sh'"

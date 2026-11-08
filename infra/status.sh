#!/usr/bin/env bash
# Configura o Uptime Kuma (status.seudominio) de uma vez (Etapa 15.4):
#   - monitores do site, da API, do painel do WhatsApp, do backup do dia e do disco/memória;
#   - alerta por e-mail quando um monitor cair (SMTP do .env);
#   - página pública em https://status.seudominio/status/pente-fino.
# As URLs dos monitores "push" (backup e vigia) vão sozinhas para o .env.
#
# Uso, na VPS: cd /opt/barbearia && ./status.sh
# Pede o login do Uptime Kuma na hora (a conta criada no primeiro acesso a status.seudominio);
# nada fica gravado. Pode rodar de novo: o que já existe não é duplicado.
set -euo pipefail
cd "$(dirname "$0")"
[[ -f .env ]] || { echo "Falta o .env: rode ./instalar.sh primeiro." >&2; exit 1; }
[[ -f status-kuma.mjs ]] || { echo "Falta o status-kuma.mjs (vem com o deploy)." >&2; exit 1; }

ler() { sed -n "s/^$1=//p" .env | tail -1 | sed "s/^['\"]//; s/['\"]$//"; }
DOMINIO="$(ler DOMINIO)"
[[ -n "$DOMINIO" ]] || { echo "DOMINIO vazio no .env." >&2; exit 1; }
REDE="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' pente-fino-status-1 2>/dev/null | awk '{print $1}')"
[[ -n "$REDE" ]] || { echo "O Uptime Kuma (serviço status) não está rodando: ./atualizar.sh" >&2; exit 1; }

echo "Login do Uptime Kuma (https://status.$DOMINIO)"
read -rp "  Usuário: " KUMA_USUARIO
read -rsp "  Senha: " KUMA_SENHA; echo
read -rp "  Código de 6 dígitos (só se ligou a verificação em duas etapas; senão Enter): " KUMA_CODIGO
padrao="$(ler ACME_EMAIL)"
read -rp "  E-mail que recebe os alertas [$padrao]: " ALERTA_EMAIL
ALERTA_EMAIL="${ALERTA_EMAIL:-$padrao}"

saida="$(
  docker run --rm -i --network "$REDE" \
    -e KUMA_URL=http://status:3001 \
    -e KUMA_USUARIO="$KUMA_USUARIO" -e KUMA_SENHA="$KUMA_SENHA" -e KUMA_CODIGO="$KUMA_CODIGO" \
    -e DOMINIO="$DOMINIO" -e ALERTA_EMAIL="$ALERTA_EMAIL" \
    -e SMTP_HOST="$(ler SMTP_HOST)" -e SMTP_PORT="$(ler SMTP_PORT)" \
    -e SMTP_USER="$(ler SMTP_USER)" -e SMTP_PASSWORD="$(ler SMTP_PASSWORD)" \
    -e EMAIL_FROM="$(ler EMAIL_FROM)" \
    -v "$PWD/status-kuma.mjs:/app/status-kuma.mjs:ro" -w /app \
    node:24-alpine sh -c 'npm install --silent --no-audit --no-fund socket.io-client@4.8.1 >/dev/null 2>&1 && node status-kuma.mjs'
)" || { echo "$saida" | grep -v '^PUSH' >&2; exit 1; }
unset KUMA_SENHA

echo "$saida" | grep -v '^PUSH' | sed 's/^OK /  ✔ /; s/^AVISO /  ! /'
# URLs dos monitores push no .env (troca a linha se existir, acrescenta se não).
while read -r _ chave url; do
  if grep -q "^$chave=" .env; then
    sed -i "s|^$chave=.*|$chave=$url|" .env
  else
    printf '%s=%s\n' "$chave" "$url" >> .env
  fi
  echo "  ✔ $chave gravado no .env"
done < <(echo "$saida" | grep '^PUSH' || true)

# Primeiro aviso agora, para os monitores push já começarem verdes.
./vigia.sh || true
URL_BACKUP="$(ler BACKUP_AVISO_URL)"
ultimo="$(ls -t backups/diario/*.enc 2>/dev/null | head -1 || true)"
if [[ -n "$URL_BACKUP" && -n "$ultimo" && -n "$(find "$ultimo" -mmin -1560 2>/dev/null)" ]]; then
  curl -fsS -m 10 "$URL_BACKUP?status=up&msg=backup%20de%20hoje" >/dev/null || true
fi
echo "Pronto. Página pública: https://status.$DOMINIO/status/pente-fino"

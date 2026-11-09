#!/usr/bin/env bash
# Liga a cópia do backup num armazenamento externo (Etapa 18), passo a passo:
#   cd /opt/barbearia && ./backup-externo.sh
# Pergunta o provedor (Backblaze B2 ou Cloudflare R2), a chave e o bucket; grava a configuração
# do rclone em ./rclone (só o usuário lê), testa o acesso, põe BACKUP_DESTINO no .env, roda um
# backup e confere que o arquivo chegou lá fora. Os arquivos já saem criptografados (AES-256)
# do backup.sh: o provedor nunca vê os dados.
#   ./backup-externo.sh --conferir   só lista o que está no armazenamento externo
set -euo pipefail
cd "$(dirname "$0")"
umask 077
[[ -f .env ]] || { echo "Falta o .env: rode ./instalar.sh primeiro." >&2; exit 1; }
ler() { sed -n "s/^$1=//p" .env | tail -1 | sed "s/^['\"]//; s/['\"]$//"; }
mkdir -p rclone
rclone() {
  docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/rclone:/config/rclone" \
    rclone/rclone:1.68.2 "$@"
}

if [[ "${1:-}" == --conferir ]]; then
  DESTINO="$(ler BACKUP_DESTINO)"
  [[ -n "$DESTINO" ]] || { echo "BACKUP_DESTINO vazio: rode ./backup-externo.sh" >&2; exit 1; }
  echo "Em $DESTINO:"
  rclone lsl "$DESTINO" | sort -k2,3 | tail -15
  exit 0
fi

echo "Onde guardar a cópia do backup?"
echo "  1) Backblaze B2   (10 GB grátis; depois ~US\$ 6 por TB/mês)"
echo "  2) Cloudflare R2  (10 GB grátis; sem taxa para baixar)"
read -rp "Escolha [1/2]: " opcao
read -rp "Nome do bucket (crie antes, privado; ex.: pente-fino-backup): " BUCKET
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9._-]{2,62}$ ]] || { echo "Nome de bucket inválido." >&2; exit 1; }

case "$opcao" in
  1)
    echo "No B2: App Keys → Add a New Application Key, com acesso só a esse bucket."
    read -rp "  keyID: " ID
    read -rsp "  applicationKey (não aparece ao digitar): " CHAVE; echo
    printf '[externo]\ntype = b2\naccount = %s\nkey = %s\nhard_delete = true\n' "$ID" "$CHAVE" > rclone/rclone.conf
    ;;
  2)
    echo "No R2: Manage R2 API Tokens → Create API token, permissão Object Read & Write só nesse bucket."
    read -rp "  Account ID (aparece na página do R2): " CONTA
    read -rp "  Access Key ID: " ID
    read -rsp "  Secret Access Key (não aparece ao digitar): " CHAVE; echo
    printf '[externo]\ntype = s3\nprovider = Cloudflare\naccess_key_id = %s\nsecret_access_key = %s\nendpoint = https://%s.r2.cloudflarestorage.com\nacl = private\nno_check_bucket = true\n' \
      "$ID" "$CHAVE" "$CONTA" > rclone/rclone.conf
    ;;
  *) echo "Opção inválida." >&2; exit 1 ;;
esac
unset CHAVE
chmod 600 rclone/rclone.conf

echo "Testando o acesso..."
teste="teste-acesso-$(date +%s).txt"
date > "rclone/$teste"
if ! docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/rclone:/config/rclone" \
  rclone/rclone:1.68.2 copyto "/config/rclone/$teste" "externo:$BUCKET/$teste" --quiet; then
  rm -f "rclone/$teste"
  echo "Não deu para gravar no bucket. Confira a chave, o nome do bucket e a permissão." >&2
  exit 1
fi
rclone deletefile "externo:$BUCKET/$teste" --quiet || true
rm -f "rclone/$teste"
echo "  ✔ acesso ok"

if grep -q '^BACKUP_DESTINO=' .env; then
  sed -i "s|^BACKUP_DESTINO=.*|BACKUP_DESTINO=externo:$BUCKET|" .env
else
  printf 'BACKUP_DESTINO=externo:%s\n' "$BUCKET" >> .env
fi
echo "  ✔ BACKUP_DESTINO=externo:$BUCKET no .env"

echo "Rodando um backup agora (leva alguns minutos)..."
./backup.sh
echo "No armazenamento externo:"
rclone lsl "externo:$BUCKET/diario" | sort -k2,3 | tail -3
echo "Pronto. Todo dia às 3h o backup vai também para lá."
echo "Teste a restauração a partir de lá: ./restaurar.sh --teste --externo"

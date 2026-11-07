#!/usr/bin/env bash
# Primeira instalação na VPS, dentro de /opt/barbearia (Etapa 17):
#   ./instalar.sh seudominio.com.br voce@email.com
#
# Cria o .env de produção (permissão 600) com todas as senhas e chaves geradas aqui mesmo, no
# servidor: nenhuma delas passa pelo Git nem pelo chat. Rodar de novo não troca nada que já existe.
# Depois, só faltam os campos marcados com PREENCHER (Asaas e e-mail), editados direto aqui:
#   nano /opt/barbearia/.env
set -euo pipefail
cd "$(dirname "$0")"

DOMINIO="${1:-}"
ACME_EMAIL="${2:-}"
if [[ -f .env ]]; then
  echo ".env já existe; nada foi trocado. Para subir: ./atualizar.sh"
  exit 0
fi
if [[ -z "$DOMINIO" || -z "$ACME_EMAIL" ]]; then
  echo "Uso: ./instalar.sh seudominio.com.br voce@email.com" >&2
  exit 1
fi

hex() { openssl rand -hex "$1"; }
b64() { openssl rand -base64 "$1" | tr -d '\n'; }

# Senha do painel da Evolution (wa.): fica só neste arquivo, legível pelo dono do servidor.
WA_SENHA="$(hex 16)"
umask 077
printf '%s\n' "$WA_SENHA" > .wa-senha
WA_SENHA_HASH="$(docker run --rm caddy:2.10-alpine caddy hash-password --plaintext "$WA_SENHA")"

# Chaves do push no celular (opcional; sem elas o push fica desligado).
VAPID="$(docker run --rm node:24-alpine npx -y web-push@3.6.7 generate-vapid-keys --json 2>/dev/null || true)"
VAPID_PUB="$(printf '%s' "$VAPID" | sed -n 's/.*"publicKey":"\([^"]*\)".*/\1/p')"
VAPID_PRIV="$(printf '%s' "$VAPID" | sed -n 's/.*"privateKey":"\([^"]*\)".*/\1/p')"

cat > .env <<EOF
# Produção do Pente Fino. Gerado por instalar.sh em $(date -u +%F). Permissão 600: não copie para
# fora do servidor. As senhas foram sorteadas aqui; troque só o que estiver marcado com PREENCHER.

DOMINIO=$DOMINIO
ACME_EMAIL=$ACME_EMAIL
# Versão das imagens (ghcr.io). atualizar.sh troca este valor.
TAG=latest

# --- Banco (só na rede interna do Docker) ---
POSTGRES_PASSWORD=$(hex 24)
DB_NAME=pente_fino
DB_OWNER_USER=pente_fino_owner
DB_OWNER_PASSWORD=$(hex 24)
DB_APP_USER=pente_fino_app
DB_APP_PASSWORD=$(hex 24)
DB_PLATAFORMA_USER=pente_fino_admin
DB_PLATAFORMA_PASSWORD=$(hex 24)
EVOLUTION_DB_USER=evolution
EVOLUTION_DB_PASSWORD=$(hex 24)

# --- Segredos da aplicação ---
JWT_ACCESS_SECRET=$(b64 48)
PLATAFORMA_CHAVE=$(b64 32)
EVOLUTION_API_KEY=$(hex 32)
WHATSAPP_WEBHOOK_SEGREDO=$(hex 32)
WA_USUARIO=admin
WA_SENHA_HASH='$WA_SENHA_HASH'

# --- E-mail de envio (Brevo, Resend, SES...) ---
# Também dá para configurar pela administração (/admin → Configurações → E-mail).
# PREENCHER: SMTP_HOST, SMTP_USER, SMTP_PASSWORD e EMAIL_FROM com o domínio verificado.
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
EMAIL_FROM="Pente Fino <nao-responda@$DOMINIO>"

# --- Asaas (cobrança das barbearias) ---
# Enquanto estiver "falso", ninguém é cobrado de verdade. Para ligar:
#   PREENCHER ASAAS_API_KEY (entre aspas simples, começa com \$) e trocar para COBRANCA_PROVEDOR=asaas.
#   No Asaas → Integrações → Webhooks: URL https://api.$DOMINIO/webhooks/asaas e o token abaixo.
COBRANCA_PROVEDOR=falso
ASAAS_API_URL=https://api.asaas.com/v3
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=$(hex 24)

# --- Push no celular ---
VAPID_CHAVE_PUBLICA=$VAPID_PUB
VAPID_CHAVE_PRIVADA=$VAPID_PRIV
VAPID_CONTATO=mailto:$ACME_EMAIL

LOG_LEVEL=info
API_DOCS=false
EOF
chmod 600 .env .wa-senha

echo ".env criado (permissão 600)."
echo "Senha do painel do WhatsApp (https://wa.$DOMINIO, usuário admin): cat /opt/barbearia/.wa-senha"
echo "Próximo passo: ./atualizar.sh"

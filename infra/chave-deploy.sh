#!/usr/bin/env bash
# Cria a chave do deploy automático, rodando NA VPS como deploy (terminal do navegador da Hostinger):
#   cd /opt/barbearia && ./chave-deploy.sh
# A chave só consegue rodar implantar.sh: sem terminal, sem redirecionar portas. A parte privada
# aparece uma vez na tela para colar no GitHub (Settings → Secrets → Actions → DEPLOY_SSH_KEY) e
# é apagada daqui. Rodar de novo troca a chave (a anterior deixa de valer).
set -euo pipefail
cd /opt/barbearia
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ssh-keygen -q -t ed25519 -N "" -C "github-actions-deploy" -f "$TMP/chave"
RESTRICAO='command="/opt/barbearia/implantar.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty'
AUT="$HOME/.ssh/authorized_keys"
grep -v 'github-actions-deploy' "$AUT" > "$TMP/aut" || true
echo "$RESTRICAO $(cat "$TMP/chave.pub")" >> "$TMP/aut"
install -m 600 "$TMP/aut" "$AUT"
echo
echo "1) Copie TODO o bloco abaixo (inclusive as linhas BEGIN e END) para o secret DEPLOY_SSH_KEY:"
echo
cat "$TMP/chave"
echo
echo "2) Variável DEPLOY_HOST (Settings → Variables → Actions): $(curl -fsS -4 -m 5 https://api.ipify.org || hostname -I | cut -d' ' -f1)"
echo "3) Variável DEPLOY_KNOWN_HOSTS: a linha abaixo"
ssh-keyscan -t ed25519 localhost 2>/dev/null | sed "s/^localhost/$(curl -fsS -4 -m 5 https://api.ipify.org || echo IP)/"

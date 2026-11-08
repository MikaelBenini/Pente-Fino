# Produção (VPS)

Uma VPS Ubuntu 24.04 (Hostinger) com Docker Compose atrás do Caddy. Tudo fica em `/opt/barbearia`:
`docker-compose.prod.yml`, `Caddyfile`, `postgres/init/`, os scripts e o `.env` (permissão 600,
nunca sai do servidor). Os arquivos vêm de `infra/` no repositório.

## Acesso

- SSH só por chave, usuário `deploy` (sudo). Root e senha bloqueados no SSH.
- Sem a chave: terminal do navegador no painel da Hostinger, com a senha de root.
- Fail2ban bloqueia quem erra o login; para liberar um IP: `sudo fail2ban-client set sshd unbanip <ip>`.
- Firewall (UFW): só 22, 80 e 443. Banco, Redis e Evolution API nunca publicam porta.

## Primeira instalação

1. DNS: registros A de `@`, `www`, `app`, `api` e `wa` apontando para o IP da VPS (o site fica no domínio principal; `www` e `app.` redirecionam para ele).
2. `cd /opt/barbearia && ./instalar.sh seudominio.com.br voce@email.com` — cria o `.env` com as
   senhas sorteadas no próprio servidor.
3. `./atualizar.sh` — baixa as imagens, roda as migrações e sobe tudo; o Caddy emite o HTTPS.
4. `./admin.sh --email voce@email.com --nome "Seu Nome"` — cria quem administra (`/admin`).
5. E-mail e Asaas: `nano .env` (campos marcados com PREENCHER) e `./atualizar.sh` de novo.
   O SMTP também pode ser configurado em `/admin → Configurações`.

## Asaas: cobrança e clube online

- A conta do Pente Fino no Asaas precisa ser de **pessoa jurídica (CNPJ)**: só ela cria as subcontas
  das barbearias para o clube online (com conta de CPF o Asaas responde 403).
- Webhook no Asaas (Integrações → Webhooks): `https://api.seudominio/webhooks/asaas`, com o token
  `ASAAS_WEBHOOK_TOKEN`, eventos de cobrança. O mesmo webhook atende a assinatura do sistema e as
  mensalidades do clube online.
- A taxa do clube online fica em `/admin` → Configurações → "Clube online".
- Nota fiscal das mensalidades (NFS-e): primeiro, no painel do Asaas, Notas fiscais →
  Configurações (inscrição municipal, regime, certificado ou senha da prefeitura). Depois, em
  `/admin` → Configurações → "Nota fiscal das mensalidades": confira a linha "Dados fiscais no
  Asaas", escolha o serviço (código e ISS conferidos com o contador), marque "Emitir nota fiscal",
  salve e clique em "Aplicar às assinaturas atuais". As assinaturas novas já saem com a nota; o
  Asaas manda a nota por e-mail para a barbearia.

## Atualizar e voltar versão (rollback)

- `./atualizar.sh` — versão do `.env` (`TAG`, padrão `latest`: o último merge na `main`).
- `./atualizar.sh <sha>` — uma versão específica (sha completo do commit na `main`).
- `./atualizar.sh anterior` — volta para a versão de antes da última atualização.

Migração de banco não se desfaz sozinha: voltar a versão só funciona se o banco novo ainda servir
para o código antigo. Antes de uma migração que apaga ou renomeia coluna, faça backup.

## Deploy automático

Cada merge na `main` gera as imagens e o job **Implantar na VPS** entra por SSH e roda
`infra/implantar.sh <sha>`: baixa os arquivos de `infra/` daquele commit, sobe a versão com
`./atualizar.sh <sha>` e recarrega o Caddy se ele mudou. A chave do GitHub só consegue rodar esse
script (sem terminal). Para ligar, uma vez, no terminal do navegador da Hostinger:

```bash
su - deploy
cd /opt/barbearia && ./chave-deploy.sh
```

E no GitHub (Settings → Secrets and variables → Actions): secret `DEPLOY_SSH_KEY` com a chave
privada mostrada, e as variáveis `DEPLOY_HOST` e `DEPLOY_KNOWN_HOSTS` com os valores mostrados.

## Monitoramento

- Uptime Kuma em `https://status.seudominio` (registro A `status`). **Crie a conta de administrador
  logo no primeiro acesso.** Monitores sugeridos:
  - HTTP: `https://seudominio/entrar` e `https://api.seudominio/health` (palavra-chave `"ok"`), a cada 60 s;
  - Push "Backup do dia" (intervalo 26 h): a URL vai em `BACKUP_AVISO_URL` no `.env`;
  - Push "Disco e memória" (intervalo 10 min): a URL vai em `VIGIA_AVISO_URL` (`vigia.sh`, cron de 5 min,
    acusa disco acima de 80% ou memória acima de 90%);
  - HTTP "WhatsApp": `http://evolution:8080/instance/connectionState/<instância>` com o cabeçalho
    `apikey` (`EVOLUTION_API_KEY` do `.env`) e palavra-chave `"open"`.
- Notificação: em Configurações → Notificações, e-mail (SMTP do Brevo) ou Telegram.
- Backup: ver docs/restaurar.md.

## Comandos úteis

```bash
cd /opt/barbearia
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f api worker
cat .wa-senha   # senha do painel da Evolution em https://wa.seudominio (usuário admin)
```

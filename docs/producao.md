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

## Atualizar e voltar versão (rollback)

- `./atualizar.sh` — versão do `.env` (`TAG`, padrão `latest`: o último merge na `main`).
- `./atualizar.sh <sha>` — uma versão específica (sha completo do commit na `main`).
- `./atualizar.sh anterior` — volta para a versão de antes da última atualização.

Migração de banco não se desfaz sozinha: voltar a versão só funciona se o banco novo ainda servir
para o código antigo. Antes de uma migração que apaga ou renomeia coluna, faça backup.

## Comandos úteis

```bash
cd /opt/barbearia
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f api worker
cat .wa-senha   # senha do painel da Evolution em https://wa.seudominio (usuário admin)
```

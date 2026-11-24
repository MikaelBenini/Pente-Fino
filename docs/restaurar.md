# Backup e restauração

O `infra/backup.sh` roda na VPS todo dia às 3h de Brasília (cron do usuário `deploy`, garantido pelo
`implantar.sh` a cada deploy, desde a verificação final de 15/11) e guarda num arquivo
criptografado (AES-256, senha `BACKUP_SENHA` do `.env`):

- usuários e permissões do PostgreSQL;
- o banco do sistema e o da Evolution API;
- o volume de sessões do WhatsApp (não precisa ler o QR code de novo);
- as fotos do site das barbearias (volume `fotos_site`, desde o lote 7c da seção 7).

Ficam 30 diários e 12 mensais em `/opt/barbearia/backups`. Com `BACKUP_DESTINO` no `.env`, a pasta
é espelhada no armazenamento externo pelo rclone. O log fica em `/opt/barbearia/backups/backup.log`.

**O backup não rodou sozinho?** (20/11/2026) Na VPS: `cd /opt/barbearia && ./diagnostico-backup.sh`.
Ele confere o serviço do cron, as linhas do backup e do vigia no crontab, permissões, o grupo
`docker`, os arquivos das últimas 26 h, o fim do `backup.log` e o que a Saúde do sistema recebeu, e
mostra o comando para testar no ambiente mínimo do cron. Como rede de segurança, o `vigia.sh` (a cada
5 minutos) roda o backup quando não há arquivo das últimas 26 h (passadas as 4h); o `backup.sh` não
roda em dobro (`flock`).

**Rode os scripts de backup como `deploy`, sem `sudo`.** Com `sudo`, a pasta `rclone` ficava do root, e o backup das 3h (do `deploy`) não lia a configuração da cópia externa (`permission denied` no `backup.log`). Desde 24/11 os scripts rodados com `sudo` usam o dono da pasta sozinhos. Para consertar uma pasta antiga: `sudo chown -R deploy:deploy /opt/barbearia/rclone`.

> **Guarde a `BACKUP_SENHA` fora do servidor** (gerenciador de senhas). Se a VPS se perder, sem
> ela o backup não abre. Ver: `grep BACKUP_SENHA /opt/barbearia/.env`.

## Ligar a cópia externa (Backblaze B2 ou Cloudflare R2)

1. Crie a conta (os dois dão 10 GB grátis, o bastante para meses de backup) e um **bucket privado**,
   por exemplo `pente-fino-backup`.
2. Crie uma chave de acesso **só para esse bucket**:
   - B2: App Keys → Add a New Application Key (anote o keyID e a applicationKey);
   - R2: Manage R2 API Tokens → Create API token, permissão Object Read & Write (anote o Account
     ID, o Access Key ID e o Secret Access Key).
3. Na VPS: `cd /opt/barbearia && ./backup-externo.sh`. O script pergunta o provedor, a chave e o
   bucket (a chave não aparece ao digitar), testa o acesso, grava `BACKUP_DESTINO` no `.env`, roda
   um backup e mostra o arquivo lá fora. O rclone roda em contêiner: nada a instalar.
4. Prove a restauração a partir de lá: `./restaurar.sh --teste --externo`.

Os arquivos saem do servidor já criptografados com a `BACKUP_SENHA`: o provedor guarda, mas não
lê. Lá fora ficam os diários dos últimos 35 dias e os mensais de 400 dias; o envio é por cópia,
então um servidor novo com a pasta vazia nunca apaga o que está guardado. Para ver o que está lá:
`./backup-externo.sh --conferir`.

Além disso, ligue o **snapshot semanal** no painel da Hostinger (VPS → Snapshots e backups).

## Testar a restauração (todo mês)

```bash
cd /opt/barbearia
./restaurar.sh --teste            # o backup mais recente
./restaurar.sh --teste backups/diario/pente-fino-2026-11-07.tar.gz.enc
```

Sobe um PostgreSQL descartável, restaura e mostra contas, usuários, comandas, migrações, o dono das
tabelas (`pente_fino_owner`) e o RLS forçado (`true`). A produção não é tocada.

## Restaurar na produção

1. Se o servidor é novo: prepare a VPS (docs/producao.md), copie `infra/` para `/opt/barbearia`,
   recrie o `.env` com a **mesma** `BACKUP_SENHA` e as mesmas senhas do banco, rode
   `./backup-externo.sh` com a mesma chave e confira com `./restaurar.sh --teste --externo`.
2. `./restaurar.sh --producao backups/diario/<arquivo>` (ou `--producao --externo` para o mais
   recente lá de fora) e digite `RESTAURAR`. Para os serviços,
   apaga os dois bancos, restaura, devolve as sessões do WhatsApp e sobe tudo de novo.
3. Confira: login no painel, uma comanda recente e a conexão do WhatsApp em Configurações.

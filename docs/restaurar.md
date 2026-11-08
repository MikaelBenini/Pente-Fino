# Backup e restauração

O `infra/backup.sh` roda na VPS todo dia às 3h (cron do usuário `deploy`) e guarda num arquivo
criptografado (AES-256, senha `BACKUP_SENHA` do `.env`):

- usuários e permissões do PostgreSQL;
- o banco do sistema e o da Evolution API;
- o volume de sessões do WhatsApp (não precisa ler o QR code de novo).

Ficam 30 diários e 12 mensais em `/opt/barbearia/backups`. Com `BACKUP_DESTINO` no `.env`, a pasta
é espelhada no armazenamento externo pelo rclone. O log fica em `/opt/barbearia/backups/backup.log`.

> **Guarde a `BACKUP_SENHA` fora do servidor** (gerenciador de senhas). Se a VPS se perder, sem
> ela o backup não abre. Ver: `grep BACKUP_SENHA /opt/barbearia/.env`.

## Ligar a cópia externa (Backblaze B2 ou Cloudflare R2)

1. Crie um bucket privado (ex.: `pente-fino-backup`) e uma chave de acesso só para ele.
2. Na VPS: `rclone config` → `n` (novo) → nome `externo` → tipo `b2` (ou `s3` com provedor
   Cloudflare para o R2) → cole a chave.
3. No `.env`: `BACKUP_DESTINO=externo:pente-fino-backup`.
4. Teste: `./backup.sh` e `rclone ls externo:pente-fino-backup`.

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
   recrie o `.env` com a **mesma** `BACKUP_SENHA` e as mesmas senhas do banco, e baixe o backup:
   `rclone copy externo:pente-fino-backup/diario/<arquivo> backups/diario/`.
2. `./restaurar.sh --producao backups/diario/<arquivo>` e digite `RESTAURAR`. Para os serviços,
   apaga os dois bancos, restaura, devolve as sessões do WhatsApp e sobe tudo de novo.
3. Confira: login no painel, uma comanda recente e a conexão do WhatsApp em Configurações.

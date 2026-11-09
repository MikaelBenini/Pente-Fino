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

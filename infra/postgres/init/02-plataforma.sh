#!/bin/sh
# Usuário da administração do sistema (/admin). Roda na primeira subida e pode rodar de novo
# num banco que já existe (pnpm infra:plataforma): não recria o que já está lá.
#
#   pente_fino_plataforma  papel de grupo (sem login): recebe nas migrações o acesso às tabelas
#                          da plataforma e o EXECUTE das funções de leitura entre contas.
#                          Nenhum acesso às tabelas das barbearias.
#   DB_PLATAFORMA_USER     login usado pela API só nas rotas /admin; membro do papel acima.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pente_fino_plataforma') THEN
      CREATE ROLE pente_fino_plataforma NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_PLATAFORMA_USER') THEN
      CREATE ROLE "$DB_PLATAFORMA_USER" LOGIN PASSWORD '$DB_PLATAFORMA_PASSWORD'
        NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
    END IF;
  END
  \$\$;
  GRANT pente_fino_plataforma TO "$DB_PLATAFORMA_USER";
  GRANT CONNECT ON DATABASE "$DB_NAME" TO "$DB_PLATAFORMA_USER";
EOSQL

echo "Usuário da administração '$DB_PLATAFORMA_USER' pronto."

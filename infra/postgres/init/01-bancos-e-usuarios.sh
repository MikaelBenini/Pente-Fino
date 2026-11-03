#!/bin/sh
# Roda só na primeira subida, com o volume vazio.
# Para recriar do zero: pnpm infra:reset
#
# Três usuários, nenhum superusuário:
#   DB_OWNER_USER  dono do banco e das tabelas; roda as migrações (Prisma).
#   DB_APP_USER    usado pela API e pelo worker; só lê e grava dados.
#                  Não é dono das tabelas, então o RLS vale para ele (Etapa 3).
#   EVOLUTION_DB_USER  dono do banco da Evolution API, separado do sistema.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  CREATE ROLE "$DB_OWNER_USER" LOGIN PASSWORD '$DB_OWNER_PASSWORD'
    NOSUPERUSER NOCREATEROLE CREATEDB NOBYPASSRLS;
  CREATE ROLE "$DB_APP_USER" LOGIN PASSWORD '$DB_APP_PASSWORD'
    NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
  CREATE ROLE "$EVOLUTION_DB_USER" LOGIN PASSWORD '$EVOLUTION_DB_PASSWORD'
    NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;

  CREATE DATABASE "$DB_NAME" OWNER "$DB_OWNER_USER" ENCODING 'UTF8' TEMPLATE template0;
  CREATE DATABASE evolution OWNER "$EVOLUTION_DB_USER" ENCODING 'UTF8' TEMPLATE template0;

  REVOKE ALL ON DATABASE "$DB_NAME" FROM PUBLIC;
  GRANT CONNECT, TEMPORARY ON DATABASE "$DB_NAME" TO "$DB_APP_USER";
  REVOKE ALL ON DATABASE evolution FROM PUBLIC;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
  ALTER SCHEMA public OWNER TO "$DB_OWNER_USER";
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
  GRANT USAGE ON SCHEMA public TO "$DB_APP_USER";

  -- Tudo que o dono criar daqui em diante fica disponível para a aplicação (só dados).
  ALTER DEFAULT PRIVILEGES FOR ROLE "$DB_OWNER_USER" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$DB_APP_USER";
  ALTER DEFAULT PRIVILEGES FOR ROLE "$DB_OWNER_USER" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "$DB_APP_USER";
  ALTER DEFAULT PRIVILEGES FOR ROLE "$DB_OWNER_USER" IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO "$DB_APP_USER";
EOSQL

echo "Bancos '$DB_NAME' e 'evolution' criados; usuários '$DB_OWNER_USER', '$DB_APP_USER' e '$EVOLUTION_DB_USER' prontos."

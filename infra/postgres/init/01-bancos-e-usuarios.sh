#!/bin/sh
# Roda só na primeira subida, com o volume vazio.
# Para recriar do zero: pnpm infra:reset
#
# Usuários, nenhum superusuário:
#   DB_OWNER_USER  dono do banco e das tabelas; roda as migrações (Prisma).
#   DB_APP_USER    usado pela API e pelo worker; só lê e grava dados.
#                  Não é dono das tabelas, então o RLS vale para ele.
#   EVOLUTION_DB_USER  dono do banco da Evolution API, separado do sistema.
#
# Papel de grupo (sem login):
#   pente_fino_aplicacao  recebe as permissões de dados nas migrações do Prisma
#                         (packages/db/prisma/migrations/*_rls). DB_APP_USER é membro.
#                         Nome fixo porque migração não lê variável de ambiente.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
  CREATE ROLE "$DB_OWNER_USER" LOGIN PASSWORD '$DB_OWNER_PASSWORD'
    NOSUPERUSER NOCREATEROLE CREATEDB NOBYPASSRLS;
  CREATE ROLE "$DB_APP_USER" LOGIN PASSWORD '$DB_APP_PASSWORD'
    NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
  CREATE ROLE "$EVOLUTION_DB_USER" LOGIN PASSWORD '$EVOLUTION_DB_PASSWORD'
    NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;

  CREATE ROLE pente_fino_aplicacao NOLOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;
  GRANT pente_fino_aplicacao TO "$DB_APP_USER";

  CREATE DATABASE "$DB_NAME" OWNER "$DB_OWNER_USER" ENCODING 'UTF8' TEMPLATE template0;
  CREATE DATABASE evolution OWNER "$EVOLUTION_DB_USER" ENCODING 'UTF8' TEMPLATE template0;
  -- Banco sombra do Prisma (prisma migrate dev). Fixo porque o dono não pode
  -- derrubar conexões, e o Prisma faria isso ao apagar um sombra temporário.
  CREATE DATABASE "${DB_NAME}_shadow" OWNER "$DB_OWNER_USER" ENCODING 'UTF8' TEMPLATE template0;

  REVOKE ALL ON DATABASE "$DB_NAME" FROM PUBLIC;
  GRANT CONNECT, TEMPORARY ON DATABASE "$DB_NAME" TO "$DB_APP_USER";
  REVOKE ALL ON DATABASE evolution FROM PUBLIC;
  REVOKE ALL ON DATABASE "${DB_NAME}_shadow" FROM PUBLIC;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_NAME" <<-EOSQL
  -- Permissões no schema e nas tabelas ficam nas migrações, para sobreviver a
  -- um prisma migrate reset (que recria o schema public).
  ALTER SCHEMA public OWNER TO "$DB_OWNER_USER";
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
EOSQL

echo "Bancos '$DB_NAME', '${DB_NAME}_shadow' e 'evolution' criados; usuários '$DB_OWNER_USER', '$DB_APP_USER' e '$EVOLUTION_DB_USER' prontos."

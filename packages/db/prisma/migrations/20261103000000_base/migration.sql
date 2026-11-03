-- Base que as outras migrações usam. Escrita à mão (o Prisma não gera funções).

-- Restrição de exclusão por igualdade + intervalo (agenda sem sobreposição).
-- btree_gist é uma extensão "trusted": o dono do banco instala sem ser superusuário.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Conta da sessão atual, definida pela API em cada transação:
--   SELECT set_config('app.conta_id', '<uuid>', true);
-- Sem conta definida devolve NULL: as políticas RLS não liberam nenhuma linha e
-- o default de conta_id falha no NOT NULL. Nunca vem do cliente.
CREATE FUNCTION conta_atual() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.conta_id', true), '')::uuid $$;

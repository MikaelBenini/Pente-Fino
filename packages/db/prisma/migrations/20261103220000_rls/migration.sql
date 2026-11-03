-- Permissões da aplicação e isolamento por conta (Row Level Security). Escrita à mão.
--
-- A aplicação conecta com um usuário membro de pente_fino_aplicacao (criado no init
-- do PostgreSQL). Ele não é dono das tabelas nem superusuário, então o RLS vale para ele.
-- FORCE faz o RLS valer até para o dono das tabelas.

-- ─── Permissões ───────────────────────────────────────────────────────────

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pente_fino_aplicacao;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pente_fino_aplicacao;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pente_fino_aplicacao;
-- Tabelas criadas nas próximas migrações (pelo mesmo dono) recebem o mesmo acesso.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pente_fino_aplicacao;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pente_fino_aplicacao;

-- Controle de migrações do Prisma: a aplicação não toca.
-- (O banco sombra do prisma migrate dev não tem essa tabela, daí o IF.)
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON _prisma_migrations FROM pente_fino_aplicacao;
  END IF;
END
$$;

-- Auditoria: a aplicação só lê e grava (o gatilho de imutabilidade é a segunda barreira).
REVOKE UPDATE, DELETE ON auditoria FROM pente_fino_aplicacao;

-- ─── Isolamento por conta ─────────────────────────────────────────────────

-- Liga o RLS numa tabela com conta_id. Toda migração que criar tabela de negócio
-- deve chamar: SELECT habilitar_isolamento_conta('nome_da_tabela');
-- (um teste em packages/db confere que nenhuma tabela com conta_id ficou sem RLS).
CREATE FUNCTION habilitar_isolamento_conta(p_tabela regclass) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_tabela);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_tabela);
  EXECUTE format(
    'CREATE POLICY isolamento_conta ON %s USING (conta_id = conta_atual()) WITH CHECK (conta_id = conta_atual())',
    p_tabela
  );
END
$$;
REVOKE ALL ON FUNCTION habilitar_isolamento_conta(regclass) FROM PUBLIC;

DO $$
DECLARE
  tabela regclass;
BEGIN
  FOR tabela IN
    SELECT c.oid::regclass
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'conta_id' AND NOT a.attisdropped
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    PERFORM habilitar_isolamento_conta(tabela);
  END LOOP;
END
$$;

-- A própria conta: a sessão só enxerga a linha dela.
ALTER TABLE conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento_conta ON conta
  USING (id = conta_atual())
  WITH CHECK (id = conta_atual());

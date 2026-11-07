-- SMTP configurado na administração (Etapa 15.1). Escrita à mão.
-- O worker (usuário da aplicação) lê a configuração do envio de e-mail; a senha vem só cifrada
-- (AES-256-GCM com PLATAFORMA_CHAVE, que fica no ambiente, nunca no banco).
CREATE FUNCTION configuracao_smtp() RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$ SELECT valor FROM configuracao_plataforma WHERE chave = 'smtp' $$;
REVOKE ALL ON FUNCTION configuracao_smtp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION configuracao_smtp() TO pente_fino_aplicacao, pente_fino_plataforma;

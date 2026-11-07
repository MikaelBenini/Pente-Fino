-- Modelos de e-mail e avisos da assinatura (Etapa 15.1). Escrita à mão.

-- Os modelos de e-mail não são segredo: a aplicação (API e worker) lê para montar os e-mails.
CREATE OR REPLACE FUNCTION configuracao_do_sistema() RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT COALESCE(jsonb_object_agg(chave, valor), '{}'::jsonb)
      FROM configuracao_plataforma
     WHERE chave IN ('aviso_geral', 'teste', 'modelos_email')
  $$;

-- Rotina diária dos avisos da assinatura (fim do teste, vencimento, cobrança vencida): lista as
-- contas em teste ou ativas sem entrar em nenhuma; o trabalho de cada uma roda dentro dela.
CREATE POLICY conta_rotina_assinatura ON conta
  FOR SELECT
  USING (current_setting('app.rotina', true) = 'assinatura' AND status IN ('teste', 'ativa'));

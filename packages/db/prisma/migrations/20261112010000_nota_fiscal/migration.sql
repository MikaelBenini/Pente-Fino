-- Nota fiscal das mensalidades do Pente Fino (Etapa 23): a configuração (serviço municipal,
-- ISS, quando emitir) é lida pela API ao criar a assinatura da barbearia no Asaas.
CREATE OR REPLACE FUNCTION configuracao_do_sistema() RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT COALESCE(jsonb_object_agg(chave, valor), '{}'::jsonb)
      FROM configuracao_plataforma
     WHERE chave IN ('aviso_geral', 'teste', 'modelos_email', 'precos', 'clube_online', 'nota_fiscal')
  $$;

-- Assinaturas do sistema no Asaas (uma por conta), para a administração aplicar a configuração
-- de nota fiscal às que já existem. Não inclui as assinaturas do clube online.
CREATE FUNCTION plataforma_assinaturas_asaas()
  RETURNS TABLE (conta_id uuid, conta text, asaas_assinatura_id text)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT c.id, c.nome, c.asaas_assinatura_id
      FROM conta c
     WHERE c.asaas_assinatura_id IS NOT NULL
     ORDER BY c.criado_em
  $$;
REVOKE ALL ON FUNCTION plataforma_assinaturas_asaas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_assinaturas_asaas() TO pente_fino_plataforma;

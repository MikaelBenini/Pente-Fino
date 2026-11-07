-- CreateTable
CREATE TABLE "configuracao_plataforma" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por_id" UUID,

    CONSTRAINT "configuracao_plataforma_pkey" PRIMARY KEY ("chave")
);


-- ─── Escrito à mão: quem lê as configurações do sistema ───────────────────
REVOKE ALL ON configuracao_plataforma FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, UPDATE ON configuracao_plataforma TO pente_fino_plataforma;

-- A aplicação (painel das barbearias, cadastro) lê só as chaves públicas: aviso geral e teste.
CREATE FUNCTION configuracao_do_sistema() RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT COALESCE(jsonb_object_agg(chave, valor), '{}'::jsonb)
      FROM configuracao_plataforma
     WHERE chave IN ('aviso_geral', 'teste')
  $$;
REVOKE ALL ON FUNCTION configuracao_do_sistema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION configuracao_do_sistema() TO pente_fino_aplicacao, pente_fino_plataforma;

-- Saúde do sistema: WhatsApp que caiu sem o dono pedir, por conta e unidade (sem dado de cliente).
CREATE FUNCTION plataforma_conexoes_caidas()
  RETURNS TABLE (conta_id uuid, conta text, unidade text, numero text, caiu_em timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT b.conta_id, c.nome, u.nome, b.numero, b.caiu_em
      FROM bot_conexao b
      JOIN conta c ON c.id = b.conta_id
      JOIN unidade u ON u.id = b.unidade_id AND u.conta_id = b.conta_id
     WHERE b.caiu_em IS NOT NULL AND b.status <> 'conectado'
     ORDER BY b.caiu_em
  $$;
REVOKE ALL ON FUNCTION plataforma_conexoes_caidas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_conexoes_caidas() TO pente_fino_plataforma;

-- Exclusão automática de dados (Etapa 15.4): rotina diária do worker, em lotes pequenos.

-- CreateTable
CREATE TABLE "execucao_limpeza" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminada_em" TIMESTAMPTZ(3),
    "apagados" JSONB NOT NULL DEFAULT '{}',
    "retidas" JSONB NOT NULL DEFAULT '[]',
    "erro" TEXT,

    CONSTRAINT "execucao_limpeza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execucao_limpeza_iniciada_em_idx" ON "execucao_limpeza"("iniciada_em");

-- O worker (usuário da aplicação) grava; a administração só lê.
REVOKE ALL ON execucao_limpeza FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, UPDATE ON execucao_limpeza TO pente_fino_aplicacao;
GRANT SELECT ON execucao_limpeza TO pente_fino_plataforma;

-- A rotina de limpeza (sem login) declara app.rotina = 'limpeza' e lista todas as contas, de
-- qualquer situação, para decidir quem avisar e quem apagar. O resto acontece dentro de cada
-- conta (naConta), com o RLS de sempre.
CREATE POLICY rotina_limpeza ON conta FOR SELECT
  USING (current_setting('app.rotina', true) = 'limpeza');

-- Conta apagada pela rotina: a auditoria da plataforma guarda só que ela existiu e quando saiu.
CREATE FUNCTION registrar_conta_apagada(p_conta uuid, p_nome text, p_motivo text)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    INSERT INTO auditoria_plataforma (acao, conta_afetada_id, depois, motivo)
    VALUES ('conta_apagada', p_conta, jsonb_build_object('conta', p_nome), p_motivo)
  $$;
REVOKE ALL ON FUNCTION registrar_conta_apagada(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_conta_apagada(uuid, text, text) TO pente_fino_aplicacao;

-- Sessões da administração vencidas ou encerradas há mais de p_dias, em lotes.
CREATE FUNCTION limpar_sessoes_plataforma(p_dias integer, p_lote integer)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM sessao_plataforma
   WHERE id IN (
     SELECT id FROM sessao_plataforma
      WHERE COALESCE(encerrada_em, expira_em) < now() - make_interval(days => p_dias)
      LIMIT p_lote
   );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;
REVOKE ALL ON FUNCTION limpar_sessoes_plataforma(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION limpar_sessoes_plataforma(integer, integer) TO pente_fino_aplicacao;

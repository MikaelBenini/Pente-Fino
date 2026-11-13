-- Acesso de suporte com consentimento (admin F5): o dono libera por 24 h nas Configurações; a
-- equipe do Pente Fino abre o painel só para ler, com tudo registrado nas duas auditorias.

-- AlterTable
ALTER TABLE "conta" ADD COLUMN "suporte_liberado_ate" TIMESTAMPTZ(3);

-- A administração lê só esta data da conta (e o nome, para a auditoria), pela função.
CREATE FUNCTION plataforma_suporte_liberado(p_conta uuid)
  RETURNS TABLE (nome text, liberado_ate timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT c.nome, c.suporte_liberado_ate FROM conta c WHERE c.id = p_conta
  $$;
REVOKE ALL ON FUNCTION plataforma_suporte_liberado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_suporte_liberado(uuid) TO pente_fino_plataforma;

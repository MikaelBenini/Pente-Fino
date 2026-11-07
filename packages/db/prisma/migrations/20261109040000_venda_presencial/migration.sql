-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "vendedor_id" UUID;


-- ─── Escrito à mão: venda presencial ──────────────────────────────────────
-- A lista de contas ganha quem vendeu e se o dono já criou a senha (convite aceito).
DROP FUNCTION plataforma_contas();
CREATE FUNCTION plataforma_contas()
  RETURNS TABLE (
    id uuid,
    nome text,
    plano plano,
    ciclo ciclo_cobranca,
    status status_conta,
    criado_em timestamptz,
    teste_ate timestamptz,
    configurada_em timestamptz,
    cobranca_automatica boolean,
    cancelada_em timestamptz,
    motivo_cancelamento text,
    vendedor_id uuid,
    dono_ativou boolean,
    unidades integer,
    profissionais integer,
    whatsapp_conectado boolean,
    fechadas_7_dias integer,
    ultima_fechada_em timestamptz,
    ultimo_acesso_em timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT
      c.id,
      c.nome,
      c.plano,
      c.ciclo,
      c.status,
      c.criado_em,
      c.teste_ate,
      c.configurada_em,
      c.asaas_assinatura_id IS NOT NULL,
      c.cancelada_em,
      c.motivo_cancelamento,
      c.vendedor_id,
      -- O dono criou a senha (aceitou o convite ou se cadastrou pelo site).
      EXISTS (SELECT 1 FROM token_acesso t
               WHERE t.conta_id = c.id AND t.tipo = 'renovacao'),
      (SELECT count(*)::int FROM unidade u WHERE u.conta_id = c.id AND u.ativa),
      (SELECT count(*)::int FROM profissional p WHERE p.conta_id = c.id AND p.ativo),
      EXISTS (SELECT 1 FROM bot_conexao b WHERE b.conta_id = c.id AND b.status = 'conectado'),
      (SELECT count(*)::int FROM comanda m
         WHERE m.conta_id = c.id AND m.status = 'fechada' AND m.fechada_em > now() - interval '7 days'),
      (SELECT max(m.fechada_em) FROM comanda m WHERE m.conta_id = c.id AND m.status = 'fechada'),
      (SELECT max(t.criado_em) FROM token_acesso t WHERE t.conta_id = c.id AND t.tipo = 'renovacao')
    FROM conta c
    ORDER BY c.criado_em DESC
  $$;
REVOKE ALL ON FUNCTION plataforma_contas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_contas() TO pente_fino_plataforma;

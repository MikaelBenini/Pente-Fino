-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "cancelada_em" TIMESTAMPTZ(3),
ADD COLUMN     "motivo_cancelamento" TEXT;


-- ─── Escrito à mão: métricas do negócio na administração ──────────────────
-- Faturas da assinatura (o que a barbearia paga ao Pente Fino) também entram na leitura da
-- plataforma; continuam sem nenhum dado de cliente da barbearia.
DO $$
BEGIN
  EXECUTE format(
    'CREATE POLICY plataforma_leitura ON fatura_assinatura FOR SELECT USING (current_user = %L)',
    current_user
  );
  -- Último acesso de cada conta: só a data da última renovação de sessão (nada do token).
  EXECUTE format(
    'CREATE POLICY plataforma_leitura ON token_acesso FOR SELECT USING (current_user = %L)',
    current_user
  );
END
$$;

-- A lista de contas ganha o cancelamento (quando e por quê).
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

-- Faturas das assinaturas de todas as contas (valor, situação, datas e forma).
CREATE FUNCTION plataforma_faturas()
  RETURNS TABLE (
    conta_id uuid,
    plano plano,
    ciclo ciclo_cobranca,
    valor integer,
    status status_fatura,
    origem origem_fatura,
    forma forma_pagamento_fatura,
    vencimento date,
    paga_em timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT f.conta_id, f.plano, f.ciclo, f.valor, f.status, f.origem, f.forma, f.vencimento, f.paga_em
      FROM fatura_assinatura f
     ORDER BY f.vencimento
  $$;
REVOKE ALL ON FUNCTION plataforma_faturas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_faturas() TO pente_fino_plataforma;

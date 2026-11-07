-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "precos_desde" DATE;


-- ─── Escrito à mão: tabelas de preço com vigência ─────────────────────────
-- Preços não são segredo: a aplicação lê as tabelas (site, cadastro, assinatura, cobrança).
CREATE OR REPLACE FUNCTION configuracao_do_sistema() RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT COALESCE(jsonb_object_agg(chave, valor), '{}'::jsonb)
      FROM configuracao_plataforma
     WHERE chave IN ('aviso_geral', 'teste', 'modelos_email', 'precos')
  $$;

-- A ficha e a lista da administração mostram a tabela contratada; trocar de plano pela
-- administração é contrato novo (tabela do dia).
CREATE OR REPLACE FUNCTION plataforma_conta(p_conta uuid) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  r jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'plano', c.plano,
    'ciclo', c.ciclo,
    'status', c.status,
    'criadaEm', c.criado_em,
    'testeAte', c.teste_ate,
    'configuradaEm', c.configurada_em,
    'cobrancaAutomatica', c.asaas_assinatura_id IS NOT NULL,
    'documento', c.documento,
    'canceladaEm', c.cancelada_em,
    'motivoCancelamento', c.motivo_cancelamento,
    'precosDesde', c.precos_desde,
    'donos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', u.nome, 'email', u.email, 'telefone', u.telefone) ORDER BY u.nome)
        FROM usuario u
       WHERE u.conta_id = p_conta AND u.ativo
         AND EXISTS (SELECT 1 FROM papel_usuario p
                      WHERE p.conta_id = p_conta AND p.usuario_id = u.id AND p.papel = 'dono')
    ), '[]'::jsonb),
    'unidades', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', un.nome, 'ativa', un.ativa) ORDER BY un.criado_em)
        FROM unidade un WHERE un.conta_id = p_conta
    ), '[]'::jsonb),
    'profissionais', (SELECT count(*) FROM profissional pr WHERE pr.conta_id = p_conta AND pr.ativo),
    'faturas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'plano', f.plano, 'ciclo', f.ciclo, 'valor', f.valor, 'status', f.status, 'origem', f.origem,
        'forma', f.forma, 'vencimento', f.vencimento, 'periodoInicio', f.periodo_inicio,
        'periodoFim', f.periodo_fim, 'pagaEm', f.paga_em, 'comprovante', f.comprovante
      ) ORDER BY f.vencimento DESC)
        FROM fatura_assinatura f WHERE f.conta_id = p_conta
    ), '[]'::jsonb)
  ) INTO r
  FROM conta c WHERE c.id = p_conta;
  RETURN r;
END
$$;

CREATE OR REPLACE FUNCTION plataforma_mudar_plano(p_conta uuid, p_plano plano, p_ciclo ciclo_cobranca)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  antes jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object('plano', plano, 'ciclo', ciclo, 'asaasAssinaturaId', asaas_assinatura_id,
         'unidades', (SELECT count(*) FROM unidade WHERE conta_id = p_conta AND ativa))
    INTO antes FROM conta WHERE id = p_conta;
  IF antes IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  UPDATE conta SET plano = p_plano, ciclo = p_ciclo, atualizado_em = now(),
         precos_desde = (now() AT TIME ZONE 'America/Sao_Paulo')::date
   WHERE id = p_conta;
  RETURN antes;
END
$$;

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
    precos_desde date,
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
      c.precos_desde,
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

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "cupom" TEXT,
ADD COLUMN     "desconto_bp" INTEGER NOT NULL DEFAULT 0;


-- ─── Escrito à mão: cupons ────────────────────────────────────────────────
ALTER TABLE conta
  ADD CONSTRAINT conta_desconto_valido CHECK (desconto_bp BETWEEN 0 AND 10000);

-- O cadastro pelo site e a venda conferem um código sem ler a lista de cupons: a função devolve
-- só aquele cupom (se existir) e quantas contas já usaram.
CREATE FUNCTION cupom_para_cadastro(p_codigo text) RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT jsonb_build_object(
      'cupom', (SELECT c FROM configuracao_plataforma cp, jsonb_array_elements(cp.valor) c
                 WHERE cp.chave = 'cupons' AND jsonb_typeof(cp.valor) = 'array'
                   AND upper(c->>'codigo') = upper(p_codigo) LIMIT 1),
      'usados', (SELECT count(*) FROM conta WHERE upper(cupom) = upper(p_codigo))
    )
  $$;
REVOKE ALL ON FUNCTION cupom_para_cadastro(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cupom_para_cadastro(text) TO pente_fino_aplicacao, pente_fino_plataforma;

-- A ficha e a lista da administração mostram o cupom e o desconto da conta.
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
    'cupom', c.cupom,
    'descontoBp', c.desconto_bp,
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
    cupom text,
    desconto_bp integer,
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
      c.cupom,
      c.desconto_bp,
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

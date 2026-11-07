-- AlterTable
ALTER TABLE "fatura_assinatura" ADD COLUMN     "comprovante" TEXT,
ADD COLUMN     "recebido_por_id" UUID;


-- ─── Escrito à mão: ações da administração numa conta ─────────────────────
-- Cada função entra na conta-alvo só durante a transação (app.conta_id) e grava pela mesma
-- política das barbearias (isolamento_conta). Nenhuma política de escrita ampla é aberta, e o
-- usuário da plataforma só faz o que estas funções fazem.
-- Atenção: dentro delas também vale a política plataforma_leitura (leitura de todas as contas
-- pelo dono das tabelas), então TODA consulta filtra a conta explicitamente. Quem chama registra a auditoria da
-- plataforma com o motivo.

-- Ficha da conta: assinatura, donos (quem paga), unidades, contagem de profissionais e faturas.
CREATE FUNCTION plataforma_conta(p_conta uuid) RETURNS jsonb
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

-- Plano e ciclo. Devolve como estava (para a auditoria e para atualizar a cobrança automática).
CREATE FUNCTION plataforma_mudar_plano(p_conta uuid, p_plano plano, p_ciclo ciclo_cobranca)
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
  UPDATE conta SET plano = p_plano, ciclo = p_ciclo, atualizado_em = now() WHERE id = p_conta;
  RETURN antes;
END
$$;

-- Fim do teste (estender, dar cortesia). Conta suspensa ou cancelada não volta por aqui.
CREATE FUNCTION plataforma_mudar_teste(p_conta uuid, p_teste_ate timestamptz)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  antes jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object('status', status, 'testeAte', teste_ate) INTO antes FROM conta WHERE id = p_conta;
  IF antes IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  IF antes->>'status' IN ('suspensa', 'cancelada') THEN RAISE EXCEPTION 'conta_parada'; END IF;
  UPDATE conta SET teste_ate = p_teste_ate, status = 'teste', atualizado_em = now() WHERE id = p_conta;
  RETURN antes;
END
$$;

-- Situação: suspender (bloquear), reativar ou cancelar (só consulta; nada é apagado).
CREATE FUNCTION plataforma_mudar_situacao(p_conta uuid, p_status status_conta, p_motivo text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  antes jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object('status', status, 'testeAte', teste_ate, 'canceladaEm', cancelada_em)
    INTO antes FROM conta WHERE id = p_conta;
  IF antes IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  UPDATE conta
     SET status = p_status,
         atualizado_em = now(),
         cancelada_em = CASE WHEN p_status = 'cancelada' THEN now() ELSE NULL END,
         motivo_cancelamento = CASE WHEN p_status = 'cancelada' THEN p_motivo ELSE NULL END
   WHERE id = p_conta;
  RETURN antes;
END
$$;

-- Pagamento manual (Pix, dinheiro, maquininha, boleto, transferência): fatura paga do período e a
-- conta passa a ativa. O próximo vencimento é o dia seguinte ao fim do período.
CREATE FUNCTION plataforma_registrar_pagamento(
  p_conta uuid,
  p_valor integer,
  p_forma forma_pagamento_fatura,
  p_paga_em timestamptz,
  p_inicio date,
  p_fim date,
  p_recebido_por uuid,
  p_comprovante text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  c conta%ROWTYPE;
  f_id uuid;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT * INTO c FROM conta WHERE id = p_conta;
  IF c.id IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  IF c.status = 'cancelada' THEN RAISE EXCEPTION 'conta_parada'; END IF;
  INSERT INTO fatura_assinatura
    (conta_id, plano, ciclo, valor, vencimento, periodo_inicio, periodo_fim, status, origem, forma,
     paga_em, recebido_por_id, comprovante, atualizado_em)
  VALUES
    (p_conta, c.plano, c.ciclo, p_valor, p_inicio, p_inicio, p_fim, 'paga', 'manual', p_forma,
     p_paga_em, p_recebido_por, p_comprovante, now())
  RETURNING id INTO f_id;
  UPDATE conta SET status = 'ativa', teste_ate = NULL, atualizado_em = now()
   WHERE id = p_conta AND status <> 'suspensa';
  RETURN jsonb_build_object('faturaId', f_id, 'statusAntes', c.status, 'plano', c.plano, 'ciclo', c.ciclo);
END
$$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'plataforma_conta(uuid)',
    'plataforma_mudar_plano(uuid, plano, ciclo_cobranca)',
    'plataforma_mudar_teste(uuid, timestamptz)',
    'plataforma_mudar_situacao(uuid, status_conta, text)',
    'plataforma_registrar_pagamento(uuid, integer, forma_pagamento_fatura, timestamptz, date, date, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO pente_fino_plataforma', f);
  END LOOP;
END
$$;

-- Cobrança manual (Etapa 15.1). Escrita à mão.

-- Rotina diária do worker: lista as contas de cobrança manual em uso (sem Asaas, ativas) sem
-- entrar em nenhuma; o trabalho de cada conta roda dentro dela (naConta).
CREATE POLICY conta_rotina_cobranca_manual ON conta
  FOR SELECT
  USING (
    current_setting('app.rotina', true) = 'cobranca_manual'
    AND asaas_assinatura_id IS NULL
    AND status = 'ativa'
  );

-- Pagamento manual quita a cobrança manual em aberto (a mais antiga), se houver; senão, cria a
-- fatura paga do período, como antes.
CREATE OR REPLACE FUNCTION plataforma_registrar_pagamento(
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
  SELECT id INTO f_id FROM fatura_assinatura
   WHERE conta_id = p_conta AND origem = 'manual' AND status IN ('aberta', 'recusada')
   ORDER BY vencimento LIMIT 1;
  IF f_id IS NOT NULL THEN
    UPDATE fatura_assinatura
       SET status = 'paga', valor = p_valor, forma = p_forma, paga_em = p_paga_em,
           periodo_inicio = p_inicio, periodo_fim = p_fim, recebido_por_id = p_recebido_por,
           comprovante = p_comprovante, atualizado_em = now()
     WHERE id = f_id AND conta_id = p_conta;
  ELSE
    INSERT INTO fatura_assinatura
      (conta_id, plano, ciclo, valor, vencimento, periodo_inicio, periodo_fim, status, origem, forma,
       paga_em, recebido_por_id, comprovante, atualizado_em)
    VALUES
      (p_conta, c.plano, c.ciclo, p_valor, p_inicio, p_inicio, p_fim, 'paga', 'manual', p_forma,
       p_paga_em, p_recebido_por, p_comprovante, now())
    RETURNING id INTO f_id;
  END IF;
  UPDATE conta SET status = 'ativa', teste_ate = NULL, atualizado_em = now()
   WHERE id = p_conta AND status <> 'suspensa';
  RETURN jsonb_build_object('faturaId', f_id, 'statusAntes', c.status, 'plano', c.plano, 'ciclo', c.ciclo);
END
$$;

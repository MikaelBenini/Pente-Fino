-- Plano fundador (Etapa 23): 30% para as 20 primeiras barbearias que ASSINAREM.
-- 1. A vaga do cupom só conta quando a conta paga (status ativa): conta em teste que nunca paga
--    não ocupa vaga. Quem se cadastrou com o cupom tem o desconto conferido de novo ao assinar.
CREATE OR REPLACE FUNCTION cupom_para_cadastro(p_codigo text) RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT jsonb_build_object(
      'cupom', (SELECT c FROM configuracao_plataforma cp, jsonb_array_elements(cp.valor) c
                 WHERE cp.chave = 'cupons' AND jsonb_typeof(cp.valor) = 'array'
                   AND upper(c->>'codigo') = upper(p_codigo) LIMIT 1),
      'usados', (SELECT count(*) FROM conta WHERE upper(cupom) = upper(p_codigo) AND status = 'ativa')
    )
  $$;

-- 2. O cupom FUNDADOR já nasce cadastrado (a administração pode mudar ou desligar).
INSERT INTO configuracao_plataforma (chave, valor)
VALUES ('cupons', '[]'::jsonb)
ON CONFLICT (chave) DO NOTHING;

UPDATE configuracao_plataforma
   SET valor = valor || jsonb_build_array(jsonb_build_object(
         'codigo', 'FUNDADOR',
         'descricao', 'Plano fundador: 30% enquanto a assinatura estiver ativa',
         'descontoBp', 3000,
         'validoAte', NULL,
         'vagas', 20,
         'ativo', true)),
       atualizado_em = now()
 WHERE chave = 'cupons'
   AND jsonb_typeof(valor) = 'array'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(valor) c WHERE upper(c->>'codigo') = 'FUNDADOR');

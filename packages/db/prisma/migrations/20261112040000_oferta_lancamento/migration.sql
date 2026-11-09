-- Oferta de lançamento (Etapa 23): o cupom FUNDADOR dá lugar ao LANCAMENTO — 30% enquanto a
-- assinatura estiver ativa, para quem assinar até 31/01/2027 (limite de 20 vagas por trás).
-- O FUNDADOR fica desativado, não apagado: quem já usou mantém o desconto (gravado na conta).
UPDATE configuracao_plataforma
   SET valor = valor || jsonb_build_array(jsonb_build_object(
         'codigo', 'LANCAMENTO',
         'descricao', 'Oferta de lançamento: 30% enquanto a assinatura estiver ativa',
         'descontoBp', 3000,
         'validoAte', '2027-01-31',
         'vagas', 20,
         'ativo', true)),
       atualizado_em = now()
 WHERE chave = 'cupons'
   AND jsonb_typeof(valor) = 'array'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(valor) c WHERE upper(c->>'codigo') = 'LANCAMENTO');

UPDATE configuracao_plataforma
   SET valor = (
         SELECT jsonb_agg(CASE WHEN upper(c->>'codigo') = 'FUNDADOR'
                               THEN c || jsonb_build_object('ativo', false)
                               ELSE c END)
           FROM jsonb_array_elements(valor) c),
       atualizado_em = now()
 WHERE chave = 'cupons'
   AND jsonb_typeof(valor) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(valor) c WHERE upper(c->>'codigo') = 'FUNDADOR');

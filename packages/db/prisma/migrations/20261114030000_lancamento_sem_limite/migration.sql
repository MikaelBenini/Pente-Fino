-- Admin R1 (decisão do dono em 2026-11-11): o cupom LANCAMENTO fica sem limite de vagas. O site
-- e os anúncios prometem "30% para sempre, para quem assinar até 31/01/2027", sem citar vagas;
-- com 20 vagas, a 21ª barbearia ficaria sem o desconto que viu no anúncio. Prazo, desconto e
-- quem já usa continuam iguais.

-- Fica na auditoria da plataforma, com o valor de antes (sem autor: foi a migração). Só quando
-- havia limite, então rodar de novo não registra nada.
INSERT INTO auditoria_plataforma (acao, antes, depois, motivo)
SELECT 'configurar_cupons',
       jsonb_build_object('codigo', 'LANCAMENTO', 'vagas', c->'vagas'),
       jsonb_build_object('codigo', 'LANCAMENTO', 'vagas', NULL),
       'Decisão do dono: oferta de lançamento sem limite de vagas (admin R1).'
  FROM configuracao_plataforma p, jsonb_array_elements(p.valor) c
 WHERE p.chave = 'cupons'
   AND jsonb_typeof(p.valor) = 'array'
   AND upper(c->>'codigo') = 'LANCAMENTO'
   AND c->'vagas' IS NOT NULL
   AND c->'vagas' <> 'null'::jsonb;

UPDATE configuracao_plataforma
   SET valor = (
         SELECT jsonb_agg(CASE WHEN upper(c->>'codigo') = 'LANCAMENTO'
                               THEN c || jsonb_build_object('vagas', NULL)
                               ELSE c END
                          ORDER BY ordem)
           FROM jsonb_array_elements(valor) WITH ORDINALITY AS t(c, ordem)),
       atualizado_em = now()
 WHERE chave = 'cupons'
   AND jsonb_typeof(valor) = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(valor) c
                WHERE upper(c->>'codigo') = 'LANCAMENTO'
                  AND c->'vagas' IS NOT NULL
                  AND c->'vagas' <> 'null'::jsonb);

-- Painel A5: "qual o horário de funcionamento?" começava o agendamento, porque "horário" estava
-- no grupo Agendar. Contas que ainda usam as palavras de fábrica desses dois grupos recebem as
-- novas; grupo que o dono mudou (qualquer palavra diferente) fica como está.
-- A tabela tem RLS forçado (nem o dono enxerga sem app.conta_id); o FORCE sai só durante
-- esta atualização, que vale para todas as contas, e volta na mesma transação.
ALTER TABLE "bot_menu" NO FORCE ROW LEVEL SECURITY;

UPDATE "bot_menu" AS b
SET "menu" = jsonb_set(
  b."menu",
  '{palavrasChave}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN g->>'id' = 'kw-agendar'
          AND g->'palavras' = '["agendar", "marcar", "horário", "agenda"]'::jsonb
          THEN jsonb_set(g, '{palavras}',
            '["agendar", "marcar", "agenda", "marcar horário", "agendar horário", "tem horário"]'::jsonb)
        WHEN g->>'id' = 'kw-endereco'
          AND g->'palavras' = '["endereço", "onde fica", "localização", "como chegar"]'::jsonb
          THEN jsonb_set(g, '{palavras}',
            '["endereço", "onde fica", "localização", "como chegar", "horário de funcionamento", "que horas abre", "que horas fecha", "abre hoje", "abre domingo", "funciona"]'::jsonb)
        ELSE g
      END
      ORDER BY ordem
    )
    FROM jsonb_array_elements(b."menu"->'palavrasChave') WITH ORDINALITY AS t(g, ordem)
  )
)
WHERE jsonb_typeof(b."menu"->'palavrasChave') = 'array'
  AND jsonb_array_length(b."menu"->'palavrasChave') > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(b."menu"->'palavrasChave') AS g
    WHERE (g->>'id' = 'kw-agendar' AND g->'palavras' = '["agendar", "marcar", "horário", "agenda"]'::jsonb)
       OR (g->>'id' = 'kw-endereco' AND g->'palavras' = '["endereço", "onde fica", "localização", "como chegar"]'::jsonb)
  );

ALTER TABLE "bot_menu" FORCE ROW LEVEL SECURITY;

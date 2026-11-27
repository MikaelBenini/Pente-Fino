-- Saúde dos números na administração (sugestão aprovada em 27/11/2026): contas com as mensagens
-- automáticas pausadas por risco ou com sinais de risco (SAIR, falhas), para o suporte agir antes
-- do bloqueio. A função só devolve contagens: nunca o texto das conversas nem telefone de cliente.
-- Reversível: DROP FUNCTION plataforma_numeros_em_risco(); DROP POLICY plataforma_leitura ON mensagem.

-- Leitura entre contas só para o dono das tabelas (dentro das funções SECURITY DEFINER), como nas
-- outras tabelas da plataforma.
DO $$
BEGIN
  EXECUTE format(
    'CREATE POLICY plataforma_leitura ON mensagem FOR SELECT USING (current_user = %L)',
    current_user
  );
END
$$;

CREATE FUNCTION plataforma_numeros_em_risco()
  RETURNS TABLE (
    conta_id uuid, conta text, unidade text, numero text, conectado_em timestamptz,
    pausado_ate timestamptz, pausa_motivo text, saidas_24h bigint, falhas_24h bigint,
    proativas_24h bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT * FROM (
      SELECT b.conta_id, c.nome, u.nome, b.numero, b.conectado_em,
             CASE WHEN b.pausado_ate > now() THEN b.pausado_ate END AS pausado_ate,
             CASE WHEN b.pausado_ate > now() THEN b.pausa_motivo END AS pausa_motivo,
             (SELECT count(*) FROM mensagem m WHERE m.unidade_id = b.unidade_id
                 AND m.direcao = 'entrada' AND lower(trim(m.texto)) = 'sair'
                 AND m.criado_em > now() - interval '24 hours') AS saidas,
             (SELECT count(*) FROM mensagem m WHERE m.unidade_id = b.unidade_id
                 AND m.direcao = 'saida' AND m.status = 'falhou'
                 AND m.criado_em > now() - interval '24 hours') AS falhas,
             (SELECT count(*) FROM mensagem m WHERE m.unidade_id = b.unidade_id
                 AND m.proativa AND m.enviada_em > now() - interval '24 hours') AS proativas
        FROM bot_conexao b
        JOIN conta c ON c.id = b.conta_id
        JOIN unidade u ON u.id = b.unidade_id AND u.conta_id = b.conta_id
       WHERE b.status = 'conectado'
    ) r
    WHERE r.pausado_ate IS NOT NULL OR r.saidas >= 3 OR r.falhas >= 3
    ORDER BY r.pausado_ate IS NULL, r.saidas DESC, r.falhas DESC
  $$;
REVOKE ALL ON FUNCTION plataforma_numeros_em_risco() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_numeros_em_risco() TO pente_fino_plataforma;

-- Gráfico semanal na administração (sugestão aprovada em 27/11/2026): automáticas, SAIR e pausas
-- das últimas semanas somando todas as contas, para ver se algum texto padrão do bot faz muita
-- gente pedir para parar. Só contagens: nada das conversas nem dos avisos.
-- Reversível: DROP FUNCTION plataforma_risco_semanal(integer); DROP POLICY plataforma_leitura ON aviso.
DO $$
BEGIN
  EXECUTE format(
    'CREATE POLICY plataforma_leitura ON aviso FOR SELECT USING (current_user = %L)',
    current_user
  );
END
$$;

CREATE FUNCTION plataforma_risco_semanal(p_semanas integer DEFAULT 8)
  RETURNS TABLE (semana date, proativas bigint, saidas bigint, pausas bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    WITH semanas AS (
      SELECT generate_series(
        date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date - (p_semanas - 1) * 7,
        date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date,
        interval '7 days'
      )::date AS semana
    )
    SELECT s.semana,
      (SELECT count(*) FROM mensagem m JOIN conta c ON c.id = m.conta_id AND NOT c.interna
        WHERE m.proativa
          AND (m.enviada_em AT TIME ZONE 'America/Sao_Paulo')::date >= s.semana
          AND (m.enviada_em AT TIME ZONE 'America/Sao_Paulo')::date < s.semana + 7),
      (SELECT count(*) FROM mensagem m JOIN conta c ON c.id = m.conta_id AND NOT c.interna
        WHERE m.direcao = 'entrada' AND lower(trim(m.texto)) = 'sair'
          AND (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date >= s.semana
          AND (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date < s.semana + 7),
      (SELECT count(DISTINCT a.chave) FROM aviso a JOIN conta c ON c.id = a.conta_id AND NOT c.interna
        WHERE a.tipo = 'whatsapp_protegido'
          AND (a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date >= s.semana
          AND (a.criado_em AT TIME ZONE 'America/Sao_Paulo')::date < s.semana + 7)
    FROM semanas s
    ORDER BY s.semana
  $$;
REVOKE ALL ON FUNCTION plataforma_risco_semanal(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_risco_semanal(integer) TO pente_fino_plataforma;

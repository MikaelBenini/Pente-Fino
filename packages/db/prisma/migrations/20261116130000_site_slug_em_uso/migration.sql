-- Endereço do site já usado por outra unidade (lote 7d). O isolamento por conta esconde as
-- unidades das outras barbearias; esta função só responde sim ou não, sem mostrar de quem é.
CREATE FUNCTION site_slug_em_uso(p_slug text, p_unidade_id uuid) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (SELECT 1 FROM unidade WHERE site_slug = p_slug AND id <> p_unidade_id);
  $$;
REVOKE ALL ON FUNCTION site_slug_em_uso(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION site_slug_em_uso(text, uuid) TO pente_fino_aplicacao;

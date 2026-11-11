-- Painel P4: sitemap com as páginas das barbearias que ligaram "Aparecer no Google". Lista entre
-- contas só o que já é público (o endereço /b/slug e quando mudou), nada além disso.
CREATE FUNCTION paginas_de_barbearia_no_google()
  RETURNS TABLE (slug text, atualizado_em timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT u.slug, u.atualizado_em
      FROM unidade u
     WHERE u.ativa AND u.agendamento_publico AND u.aparecer_no_google AND u.slug IS NOT NULL
     ORDER BY u.slug
  $$;
REVOKE ALL ON FUNCTION paginas_de_barbearia_no_google() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION paginas_de_barbearia_no_google() TO pente_fino_aplicacao;

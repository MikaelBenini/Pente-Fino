-- Domínio próprio do site da barbearia (seção 7, lote 7e). O dono informa o domínio, o sistema
-- confere o DNS e o Caddy emite o certificado na hora, só para domínio conferido.

ALTER TABLE "unidade" ADD COLUMN "dominio" TEXT;
ALTER TABLE "unidade" ADD COLUMN "dominio_verificado_em" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "unidade_dominio_key" ON "unidade"("dominio");
ALTER TABLE unidade
  ADD CONSTRAINT unidade_dominio_formato CHECK (dominio IS NULL OR (dominio = lower(dominio) AND dominio !~ '^www\.' AND length(dominio) BETWEEN 4 AND 253));

-- Quem chega pelo domínio só tem o nome dele: a API declara o domínio (app.dominio) e enxerga
-- só aquela unidade, e só com o domínio conferido e o site publicado.
CREATE POLICY publico_por_dominio ON unidade
  FOR SELECT
  USING (dominio_verificado_em IS NOT NULL AND site_publicado IS NOT NULL
         AND dominio = nullif(current_setting('app.dominio', true), ''));

-- Domínio já cadastrado por outra unidade (de qualquer barbearia): só sim ou não.
CREATE FUNCTION dominio_em_uso(p_dominio text, p_unidade_id uuid) RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (SELECT 1 FROM unidade WHERE dominio = p_dominio AND id <> p_unidade_id);
  $$;
REVOKE ALL ON FUNCTION dominio_em_uso(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dominio_em_uso(text, uuid) TO pente_fino_aplicacao;

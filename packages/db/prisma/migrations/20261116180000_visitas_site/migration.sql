-- O que o visitante faz na página de vendas (pedido do dono em 13/11): eventos anônimos da visita
-- (entrada, rolagem e clique), sem dado pessoal. Tabela só da administração: a aplicação das
-- barbearias não enxerga; a API grava e lê com o usuário da plataforma.
-- CreateTable
CREATE TABLE "evento_visita_site" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "visita_id" UUID NOT NULL,
    "novo" BOOLEAN,
    "origem" TEXT,
    "tipo" TEXT NOT NULL,
    "pagina" TEXT NOT NULL,
    "valor" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_visita_site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evento_visita_site_criado_em_idx" ON "evento_visita_site"("criado_em");

-- CreateIndex
CREATE INDEX "evento_visita_site_visita_id_idx" ON "evento_visita_site"("visita_id");

REVOKE ALL ON evento_visita_site FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, DELETE ON evento_visita_site TO pente_fino_plataforma;

-- A rotina diária de limpeza (usuário da aplicação) apaga os eventos com mais de 90 dias, em lotes.
CREATE FUNCTION limpar_visitas_site(p_dias integer, p_lote integer)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM evento_visita_site
   WHERE id IN (
     SELECT id FROM evento_visita_site
      WHERE criado_em < now() - make_interval(days => p_dias)
      LIMIT p_lote
   );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;
REVOKE ALL ON FUNCTION limpar_visitas_site(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION limpar_visitas_site(integer, integer) TO pente_fino_aplicacao;

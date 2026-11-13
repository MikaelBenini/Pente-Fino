-- Site e link de agendamento em endereços separados (seção 7, lote 7d). O site tem endereço
-- próprio (/s/<site_slug>); o link continua em /b/<slug>. Endereço trocado vai para
-- endereco_antigo e leva ao atual.

ALTER TABLE "unidade" ADD COLUMN "site_slug" TEXT;
CREATE UNIQUE INDEX "unidade_site_slug_key" ON "unidade"("site_slug");
ALTER TABLE unidade
  ADD CONSTRAINT unidade_site_slug_formato CHECK (site_slug IS NULL OR (site_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(site_slug) BETWEEN 3 AND 60));

-- Quem abre o site só tem o endereço dele: a API declara o endereço na transação
-- (app.slug_site) e enxerga só aquela unidade, e só com o site publicado.
CREATE POLICY publico_por_site_slug ON unidade
  FOR SELECT
  USING (site_publicado IS NOT NULL AND site_slug = nullif(current_setting('app.slug_site', true), ''));

-- CreateTable
CREATE TABLE "endereco_antigo" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endereco_antigo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "endereco_antigo_tipo_check" CHECK ("tipo" IN ('agendamento', 'site'))
);

-- CreateIndex
CREATE UNIQUE INDEX "endereco_antigo_conta_id_tipo_slug_key" ON "endereco_antigo"("conta_id", "tipo", "slug");
CREATE INDEX "endereco_antigo_tipo_slug_idx" ON "endereco_antigo"("tipo", "slug");

-- AddForeignKey
ALTER TABLE "endereco_antigo" ADD CONSTRAINT "endereco_antigo_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "endereco_antigo" ADD CONSTRAINT "endereco_antigo_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SELECT habilitar_isolamento_conta('endereco_antigo');

-- Quem chega por um endereço antigo: a API declara "tipo:slug" (app.endereco_antigo) e enxerga
-- só esse registro, para descobrir a unidade e mandar ao endereço atual.
CREATE POLICY endereco_antigo_publico ON endereco_antigo
  FOR SELECT
  USING (tipo || ':' || slug = nullif(current_setting('app.endereco_antigo', true), ''));

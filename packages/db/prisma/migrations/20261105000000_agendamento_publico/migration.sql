-- AlterTable
ALTER TABLE "unidade" ADD COLUMN     "agendamento_publico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "unidade_slug_key" ON "unidade"("slug");


-- ─── Escrito à mão ────────────────────────────────────────────────────────

ALTER TABLE unidade
  ADD CONSTRAINT unidade_slug_formato CHECK (slug IS NULL OR (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60));

-- Página pública de agendamento: quem acessa só tem o endereço (slug). A API declara
-- o slug na transação (app.slug_publico) e enxerga só aquela unidade, e só se o link
-- estiver ligado. Depois disso a API trabalha dentro da conta da unidade (naConta).
CREATE POLICY publico_por_slug ON unidade
  FOR SELECT
  USING (agendamento_publico AND slug = nullif(current_setting('app.slug_publico', true), ''));

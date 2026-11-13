-- Site da barbearia (seção 7, lote 7a): rascunho que o dono edita e a cópia publicada.
ALTER TABLE "unidade"
  ADD COLUMN "site_rascunho" JSONB,
  ADD COLUMN "site_publicado" JSONB,
  ADD COLUMN "site_publicado_em" TIMESTAMPTZ(3);

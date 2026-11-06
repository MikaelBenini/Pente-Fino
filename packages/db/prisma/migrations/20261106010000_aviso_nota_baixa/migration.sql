-- Nota 1 ou 2: o aviso para dono e gestor sai uma vez só.
ALTER TABLE "avaliacao" ADD COLUMN "gestao_avisada_em" TIMESTAMPTZ(3);

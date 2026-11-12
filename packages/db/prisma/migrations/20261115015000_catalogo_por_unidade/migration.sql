-- Catálogo por unidade (pedido do dono em 12/11/2026): cada serviço e produto diz em quais
-- unidades está ("Disponível em"). Os de hoje ficam em todas as unidades que já existem (nada muda
-- para quem usa); unidade criada depois começa vazia, com "Copiar catálogo de outra unidade".

-- AlterTable
ALTER TABLE "servico" ADD COLUMN "unidade_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "produto" ADD COLUMN "unidade_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

-- CreateIndex
CREATE INDEX "servico_unidade_ids_idx" ON "servico" USING GIN ("unidade_ids");
CREATE INDEX "produto_unidade_ids_idx" ON "produto" USING GIN ("unidade_ids");

-- As tabelas têm RLS forçado (nem o dono enxerga sem app.conta_id); o FORCE sai só durante
-- este preenchimento, que vale para todas as contas, e volta na mesma transação.
ALTER TABLE "servico" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "produto" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "unidade" NO FORCE ROW LEVEL SECURITY;

UPDATE "servico" AS s
SET "unidade_ids" = COALESCE(
  (SELECT array_agg(u."id" ORDER BY u."criado_em") FROM "unidade" u WHERE u."conta_id" = s."conta_id"),
  ARRAY[]::UUID[]
);

UPDATE "produto" AS p
SET "unidade_ids" = COALESCE(
  (SELECT array_agg(u."id" ORDER BY u."criado_em") FROM "unidade" u WHERE u."conta_id" = p."conta_id"),
  ARRAY[]::UUID[]
);

ALTER TABLE "servico" FORCE ROW LEVEL SECURITY;
ALTER TABLE "produto" FORCE ROW LEVEL SECURITY;
ALTER TABLE "unidade" FORCE ROW LEVEL SECURITY;

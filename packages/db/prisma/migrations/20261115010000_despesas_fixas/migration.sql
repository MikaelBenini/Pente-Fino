-- Despesas fixas no mês seguinte (pedido do dono em 11/11/2026): "Copiar fixas do mês anterior"
-- com prévia editável e "Repetir todo mês". A origem é única: cada despesa vira no máximo uma
-- cópia no mês seguinte, então a cópia manual e a rotina nunca lançam duas vezes.

-- AlterTable
ALTER TABLE "despesa" ADD COLUMN "repetir" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "origem_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "despesa_origem_id_key" ON "despesa"("origem_id");

-- AddForeignKey
ALTER TABLE "despesa" ADD CONSTRAINT "despesa_origem_id_fkey" FOREIGN KEY ("origem_id") REFERENCES "despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

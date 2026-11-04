-- AlterTable
ALTER TABLE "comanda" ADD COLUMN     "confirmada_por_id" UUID;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_confirmada_por_id_fkey" FOREIGN KEY ("confirmada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


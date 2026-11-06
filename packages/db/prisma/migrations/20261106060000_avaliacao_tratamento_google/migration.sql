-- AlterEnum
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'convite_google';

-- AlterTable
ALTER TABLE "unidade" ADD COLUMN     "link_avaliacao_google" TEXT;

-- AlterTable
ALTER TABLE "avaliacao" ADD COLUMN     "tratada_em" TIMESTAMPTZ(3),
ADD COLUMN     "tratada_por_id" UUID,
ADD COLUMN     "tratamento" TEXT;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_tratada_por_id_fkey" FOREIGN KEY ("tratada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


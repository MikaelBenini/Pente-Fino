-- AlterEnum
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'nao_entendi_de_novo';

-- AlterTable
ALTER TABLE "bot_sessao" ADD COLUMN     "atendente_desde" TIMESTAMPTZ(3),
ADD COLUMN     "cliente_id" UUID;

-- CreateIndex
CREATE INDEX "bot_sessao_unidade_id_atualizado_em_idx" ON "bot_sessao"("unidade_id", "atualizado_em");

-- AddForeignKey
ALTER TABLE "bot_sessao" ADD CONSTRAINT "bot_sessao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

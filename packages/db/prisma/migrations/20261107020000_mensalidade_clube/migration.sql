-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "pix" JSONB;

-- AlterTable
ALTER TABLE "adesao_clube" ADD COLUMN     "aviso_vencimento_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "pagamento_clube" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "adesao_id" UUID NOT NULL,
    "valor" INTEGER NOT NULL,
    "forma" "forma_pagamento" NOT NULL,
    "pago_em" DATE NOT NULL,
    "referente_a" DATE NOT NULL,
    "recebido_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamento_clube_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagamento_clube_conta_id_pago_em_idx" ON "pagamento_clube"("conta_id", "pago_em");

-- CreateIndex
CREATE INDEX "pagamento_clube_adesao_id_idx" ON "pagamento_clube"("adesao_id");

-- AddForeignKey
ALTER TABLE "pagamento_clube" ADD CONSTRAINT "pagamento_clube_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_clube" ADD CONSTRAINT "pagamento_clube_adesao_id_fkey" FOREIGN KEY ("adesao_id") REFERENCES "adesao_clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_clube" ADD CONSTRAINT "pagamento_clube_recebido_por_id_fkey" FOREIGN KEY ("recebido_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "pagamento_clube" ADD CONSTRAINT pagamento_clube_valor CHECK (valor >= 0);

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('pagamento_clube');

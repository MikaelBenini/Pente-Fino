-- Receber adiantado, o sinal (painel A2, aprovado pelo dono em 11/11/2026): o pagamento fica na
-- comanda aberta, entra no caixa do dia em que foi recebido e abate do total ao fechar. Devolvido,
-- sai do caixa no dia da devolução; sem devolver, fica retido.

-- AlterTable
ALTER TABLE "pagamento" ADD COLUMN "sinal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "devolvido_em" TIMESTAMPTZ(3);

ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_devolvido_so_sinal_check"
  CHECK ("devolvido_em" IS NULL OR "sinal");

-- CreateIndex
CREATE INDEX "pagamento_sinal_idx" ON "pagamento"("conta_id", "criado_em") WHERE "sinal";

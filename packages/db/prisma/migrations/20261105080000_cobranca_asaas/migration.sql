-- Cobrança pelo Asaas: documento de quem paga e os ids do cliente e da assinatura.
ALTER TABLE "conta" ADD COLUMN "asaas_assinatura_id" TEXT,
ADD COLUMN "asaas_cliente_id" TEXT,
ADD COLUMN "documento" TEXT;

CREATE UNIQUE INDEX "conta_asaas_cliente_id_key" ON "conta"("asaas_cliente_id");
CREATE UNIQUE INDEX "conta_asaas_assinatura_id_key" ON "conta"("asaas_assinatura_id");

ALTER TABLE "conta"
  ADD CONSTRAINT conta_documento_digitos CHECK (documento IS NULL OR documento ~ '^(\d{11}|\d{14})$');

-- O webhook do Asaas chega sem login: acha a conta pelo cliente do Asaas declarado na
-- transação (app.cliente_asaas), e só ela, como o link público e o webhook do WhatsApp.
CREATE POLICY conta_por_cliente_asaas ON conta
  FOR SELECT
  USING (asaas_cliente_id = nullif(current_setting('app.cliente_asaas', true), ''));

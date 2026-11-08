
-- AlterTable
ALTER TABLE "pagamento_clube" ADD COLUMN     "credito_previsto" DATE,
ADD COLUMN     "id_externo" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'balcao',
ADD COLUMN     "repasse" INTEGER,
ADD COLUMN     "taxa_asaas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxa_plataforma" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "recebimento_online" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "asaas_conta_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "api_key_cifrada" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'documentos',
    "nome" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recebimento_online_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinatura_clube_online" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "item_clube_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "asaas_cliente_id" TEXT NOT NULL,
    "asaas_assinatura_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aguardando',
    "adesao_id" UUID,
    "link" TEXT,
    "taxa_bp" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assinatura_clube_online_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recebimento_online_conta_id_key" ON "recebimento_online"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_clube_online_asaas_assinatura_id_key" ON "assinatura_clube_online"("asaas_assinatura_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_clube_online_adesao_id_key" ON "assinatura_clube_online"("adesao_id");

-- CreateIndex
CREATE INDEX "assinatura_clube_online_conta_id_idx" ON "assinatura_clube_online"("conta_id");

-- CreateIndex
CREATE INDEX "assinatura_clube_online_cliente_id_idx" ON "assinatura_clube_online"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_clube_conta_id_id_externo_key" ON "pagamento_clube"("conta_id", "id_externo");

-- AddForeignKey
ALTER TABLE "recebimento_online" ADD CONSTRAINT "recebimento_online_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_clube_online" ADD CONSTRAINT "assinatura_clube_online_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_clube_online" ADD CONSTRAINT "assinatura_clube_online_item_clube_id_fkey" FOREIGN KEY ("item_clube_id") REFERENCES "item_clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_clube_online" ADD CONSTRAINT "assinatura_clube_online_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_clube_online" ADD CONSTRAINT "assinatura_clube_online_adesao_id_fkey" FOREIGN KEY ("adesao_id") REFERENCES "adesao_clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;


SELECT habilitar_isolamento_conta('recebimento_online');
SELECT habilitar_isolamento_conta('assinatura_clube_online');

-- Webhook do Asaas: acha a assinatura do clube (e a conta dela) pelo id da assinatura no Asaas,
-- só dentro da transação que define app.assinatura_clube, como o webhook da cobrança do sistema.
CREATE POLICY assinatura_clube_por_asaas ON assinatura_clube_online
  FOR SELECT
  USING (asaas_assinatura_id = nullif(current_setting('app.assinatura_clube', true), ''));

-- Link de assinatura do clube (/assinar?u=slug): enxerga a unidade pelo slug declarado na
-- transação (app.slug_clube), mesmo com o agendamento público desligado. Os planos e a conta
-- para receber são lidos depois, já dentro da conta da unidade.
CREATE POLICY unidade_por_slug_clube ON unidade
  FOR SELECT
  USING (slug = nullif(current_setting('app.slug_clube', true), ''));

-- A taxa do clube online não é segredo: a aplicação lê para montar o split.
CREATE OR REPLACE FUNCTION configuracao_do_sistema() RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT COALESCE(jsonb_object_agg(chave, valor), '{}'::jsonb)
      FROM configuracao_plataforma
     WHERE chave IN ('aviso_geral', 'teste', 'modelos_email', 'precos', 'clube_online')
  $$;

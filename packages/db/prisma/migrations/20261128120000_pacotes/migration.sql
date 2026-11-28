-- Pacotes de sessões (Fase 1d, E2): o modelo que a conta vende e o pacote vendido ao cliente.
-- Nos números, igual ao clube (packages/shared/src/pacotes.ts).


-- AlterTable
ALTER TABLE "item_comanda" ADD COLUMN     "pacote_cliente_id" UUID;

-- CreateTable
CREATE TABLE "pacote" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "sessoes" INTEGER NOT NULL,
    "validade_dias" INTEGER NOT NULL,
    "valor" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacote_cliente" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "pacote_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "sessoes" INTEGER NOT NULL,
    "valor_pago" INTEGER NOT NULL,
    "forma" "forma_pagamento" NOT NULL,
    "pago_em" DATE NOT NULL,
    "valido_ate" DATE NOT NULL,
    "cancelado_em" TIMESTAMPTZ(3),
    "motivo_cancelamento" TEXT,
    "vendido_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacote_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pacote_conta_id_idx" ON "pacote"("conta_id");

-- CreateIndex
CREATE INDEX "pacote_unidade_id_idx" ON "pacote"("unidade_id");

-- CreateIndex
CREATE INDEX "pacote_cliente_conta_id_pago_em_idx" ON "pacote_cliente"("conta_id", "pago_em");

-- CreateIndex
CREATE INDEX "pacote_cliente_cliente_id_idx" ON "pacote_cliente"("cliente_id");

-- CreateIndex
CREATE INDEX "item_comanda_pacote_cliente_id_idx" ON "item_comanda"("pacote_cliente_id");

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_pacote_cliente_id_fkey" FOREIGN KEY ("pacote_cliente_id") REFERENCES "pacote_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote" ADD CONSTRAINT "pacote_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_cliente" ADD CONSTRAINT "pacote_cliente_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_cliente" ADD CONSTRAINT "pacote_cliente_pacote_id_fkey" FOREIGN KEY ("pacote_id") REFERENCES "pacote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_cliente" ADD CONSTRAINT "pacote_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_cliente" ADD CONSTRAINT "pacote_cliente_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pacote_cliente" ADD CONSTRAINT "pacote_cliente_vendido_por_id_fkey" FOREIGN KEY ("vendido_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "pacote" ADD CONSTRAINT "pacote_numeros_validos"
  CHECK (sessoes BETWEEN 2 AND 100 AND validade_dias BETWEEN 7 AND 730 AND valor > 0);
ALTER TABLE "pacote_cliente" ADD CONSTRAINT "pacote_cliente_numeros_validos"
  CHECK (sessoes > 0 AND valor_pago >= 0 AND valido_ate >= pago_em);

SELECT habilitar_isolamento_conta('pacote');
SELECT habilitar_isolamento_conta('pacote_cliente');

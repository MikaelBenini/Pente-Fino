-- CreateEnum
CREATE TYPE "status_fatura" AS ENUM ('aberta', 'paga', 'recusada', 'cancelada');

-- CreateEnum
CREATE TYPE "forma_pagamento_fatura" AS ENUM ('pix', 'cartao', 'boleto', 'dinheiro', 'transferencia');

-- CreateEnum
CREATE TYPE "origem_fatura" AS ENUM ('asaas', 'manual');

-- CreateTable
CREATE TABLE "fatura_assinatura" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "plano" "plano" NOT NULL,
    "ciclo" "ciclo_cobranca" NOT NULL,
    "valor" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "status" "status_fatura" NOT NULL DEFAULT 'aberta',
    "origem" "origem_fatura" NOT NULL DEFAULT 'asaas',
    "forma" "forma_pagamento_fatura",
    "paga_em" TIMESTAMPTZ(3),
    "motivo_recusa" TEXT,
    "link_pagamento" TEXT,
    "id_externo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fatura_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fatura_assinatura_conta_id_vencimento_idx" ON "fatura_assinatura"("conta_id", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "fatura_assinatura_origem_id_externo_key" ON "fatura_assinatura"("origem", "id_externo");

-- AddForeignKey
ALTER TABLE "fatura_assinatura" ADD CONSTRAINT "fatura_assinatura_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('fatura_assinatura');

ALTER TABLE "fatura_assinatura"
  ADD CONSTRAINT fatura_valor_positivo CHECK (valor > 0),
  ADD CONSTRAINT fatura_periodo_valido CHECK (periodo_fim >= periodo_inicio),
  ADD CONSTRAINT fatura_paga_tem_data CHECK (status <> 'paga' OR (paga_em IS NOT NULL AND forma IS NOT NULL)),
  ADD CONSTRAINT fatura_recusada_tem_motivo CHECK (status <> 'recusada' OR motivo_recusa IS NOT NULL);

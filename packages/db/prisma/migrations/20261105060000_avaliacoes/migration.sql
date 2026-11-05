-- CreateEnum
CREATE TYPE "status_avaliacao" AS ENUM ('agendada', 'enviada', 'respondida', 'cancelada');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'pesquisa_atendimento';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'pesquisa_barbearia';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'pesquisa_comentario';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'pesquisa_obrigado';

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "pesquisa_pos_atendimento" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "avaliacao" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "comanda_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "status" "status_avaliacao" NOT NULL DEFAULT 'agendada',
    "nota_atendimento" INTEGER,
    "nota_barbearia" INTEGER,
    "comentario" TEXT,
    "enviar_em" TIMESTAMPTZ(3) NOT NULL,
    "enviada_em" TIMESTAMPTZ(3),
    "respondida_em" TIMESTAMPTZ(3),
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "avaliacao_comanda_id_key" ON "avaliacao"("comanda_id");

-- CreateIndex
CREATE INDEX "avaliacao_conta_id_idx" ON "avaliacao"("conta_id");

-- CreateIndex
CREATE INDEX "avaliacao_profissional_id_respondida_em_idx" ON "avaliacao"("profissional_id", "respondida_em");

-- CreateIndex
CREATE INDEX "avaliacao_unidade_id_respondida_em_idx" ON "avaliacao"("unidade_id", "respondida_em");

-- CreateIndex
CREATE INDEX "avaliacao_cliente_id_criado_em_idx" ON "avaliacao"("cliente_id", "criado_em");

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('avaliacao');

-- Notas de 1 a 5; respondida tem nota do atendimento e data; prazo depois do envio.
ALTER TABLE "avaliacao"
  ADD CONSTRAINT avaliacao_nota_atendimento_valida
    CHECK (nota_atendimento IS NULL OR nota_atendimento BETWEEN 1 AND 5),
  ADD CONSTRAINT avaliacao_nota_barbearia_valida
    CHECK (nota_barbearia IS NULL OR nota_barbearia BETWEEN 1 AND 5),
  ADD CONSTRAINT avaliacao_respondida_tem_nota
    CHECK (status <> 'respondida' OR (nota_atendimento IS NOT NULL AND respondida_em IS NOT NULL)),
  ADD CONSTRAINT avaliacao_prazo_depois_do_envio CHECK (expira_em > enviar_em),
  ADD CONSTRAINT avaliacao_comentario_curto CHECK (comentario IS NULL OR length(comentario) <= 500);

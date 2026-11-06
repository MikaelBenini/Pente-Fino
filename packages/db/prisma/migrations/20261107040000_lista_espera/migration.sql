-- CreateEnum
CREATE TYPE "status_espera" AS ENUM ('aguardando', 'oferecido', 'atendido', 'cancelado');

-- CreateEnum
CREATE TYPE "origem_espera" AS ENUM ('balcao', 'bot', 'site', 'antecipar');

-- CreateTable
CREATE TABLE "lista_espera" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "profissional_id" UUID,
    "servico_ids" UUID[],
    "dia" DATE NOT NULL,
    "de_min" INTEGER NOT NULL,
    "ate_min" INTEGER NOT NULL,
    "origem" "origem_espera" NOT NULL,
    "agendamento_id" UUID,
    "status" "status_espera" NOT NULL DEFAULT 'aguardando',
    "oferta" JSONB,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lista_espera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lista_espera_conta_id_idx" ON "lista_espera"("conta_id");

-- CreateIndex
CREATE INDEX "lista_espera_unidade_id_dia_status_idx" ON "lista_espera"("unidade_id", "dia", "status");

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_espera" ADD CONSTRAINT "lista_espera_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "lista_espera"
  ADD CONSTRAINT lista_espera_faixa CHECK (de_min >= 0 AND ate_min <= 1440 AND ate_min >= de_min),
  ADD CONSTRAINT lista_espera_servicos CHECK (cardinality(servico_ids) BETWEEN 1 AND 5);

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('lista_espera');

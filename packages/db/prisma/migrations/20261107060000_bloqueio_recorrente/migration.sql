-- CreateTable
CREATE TABLE "bloqueio_recorrente" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "profissional_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "inicio_min" INTEGER NOT NULL,
    "fim_min" INTEGER NOT NULL,
    "desde" DATE NOT NULL,
    "ate" DATE,
    "motivo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueio_recorrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bloqueio_recorrente_conta_id_idx" ON "bloqueio_recorrente"("conta_id");

-- CreateIndex
CREATE INDEX "bloqueio_recorrente_profissional_id_idx" ON "bloqueio_recorrente"("profissional_id");

-- AddForeignKey
ALTER TABLE "bloqueio_recorrente" ADD CONSTRAINT "bloqueio_recorrente_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueio_recorrente" ADD CONSTRAINT "bloqueio_recorrente_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "bloqueio_recorrente"
  ADD CONSTRAINT bloqueio_recorrente_valores CHECK (
    dia_semana BETWEEN 0 AND 6 AND inicio_min >= 0 AND fim_min <= 1440 AND fim_min > inicio_min
    AND (ate IS NULL OR ate >= desde)
  );

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('bloqueio_recorrente');

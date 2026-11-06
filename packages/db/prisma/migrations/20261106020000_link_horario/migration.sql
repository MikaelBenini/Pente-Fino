-- CreateTable
CREATE TABLE "link_horario" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "agendamento_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "link_horario_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "link_horario_agendamento_id_key" ON "link_horario"("agendamento_id");
-- CreateIndex
CREATE UNIQUE INDEX "link_horario_token_hash_key" ON "link_horario"("token_hash");
-- CreateIndex
CREATE INDEX "link_horario_conta_id_idx" ON "link_horario"("conta_id");
-- AddForeignKey
ALTER TABLE "link_horario" ADD CONSTRAINT "link_horario_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "link_horario" ADD CONSTRAINT "link_horario_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('link_horario');

-- Link do cliente (/horario/:token): sem login, a API declara o hash do token na transação
-- (app.token_horario) e enxerga só aquele link, para descobrir a conta. Depois trabalha
-- dentro da conta (naConta).
CREATE POLICY publico_por_token_horario ON link_horario
  FOR SELECT
  USING (token_hash = nullif(current_setting('app.token_horario', true), ''));

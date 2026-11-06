-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "canal_preferido" TEXT;

-- CreateTable
CREATE TABLE "token_agendamento" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_agendamento_token_hash_key" ON "token_agendamento"("token_hash");

-- CreateIndex
CREATE INDEX "token_agendamento_conta_id_idx" ON "token_agendamento"("conta_id");

-- AddForeignKey
ALTER TABLE "token_agendamento" ADD CONSTRAINT "token_agendamento_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_agendamento" ADD CONSTRAINT "token_agendamento_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_agendamento" ADD CONSTRAINT "token_agendamento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "cliente"
  ADD CONSTRAINT cliente_canal_preferido_valido CHECK (canal_preferido IS NULL OR canal_preferido IN ('conversa', 'site'));

-- Isolamento por conta (RLS), como toda tabela de negócio. O site acha a conta pelo slug da
-- unidade e procura o token já dentro da conta (naConta).
SELECT habilitar_isolamento_conta('token_agendamento');

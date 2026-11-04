-- CreateEnum
CREATE TYPE "direcao_mensagem" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "status_mensagem" AS ENUM ('recebida', 'pendente', 'enviada', 'falhou', 'descartada');

-- AlterEnum
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'convite_avisos';

-- AlterTable
ALTER TABLE "bot_conexao" ADD COLUMN     "caiu_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "consentimento_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "bot_sessao" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "telefone" TEXT NOT NULL,
    "sessao" JSONB NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bot_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagem" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "cliente_id" UUID,
    "telefone" TEXT NOT NULL,
    "direcao" "direcao_mensagem" NOT NULL,
    "texto" TEXT NOT NULL,
    "status" "status_mensagem" NOT NULL,
    "id_externo" TEXT,
    "erro" TEXT,
    "enviada_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_sessao_conta_id_idx" ON "bot_sessao"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_sessao_unidade_id_telefone_key" ON "bot_sessao"("unidade_id", "telefone");

-- CreateIndex
CREATE INDEX "mensagem_conta_id_cliente_id_criado_em_idx" ON "mensagem"("conta_id", "cliente_id", "criado_em");

-- CreateIndex
CREATE INDEX "mensagem_unidade_id_telefone_criado_em_idx" ON "mensagem"("unidade_id", "telefone", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "mensagem_unidade_id_id_externo_key" ON "mensagem"("unidade_id", "id_externo");

-- AddForeignKey
ALTER TABLE "bot_sessao" ADD CONSTRAINT "bot_sessao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_sessao" ADD CONSTRAINT "bot_sessao_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Escrito à mão ────────────────────────────────────────────────────────

SELECT habilitar_isolamento_conta('bot_sessao');
SELECT habilitar_isolamento_conta('mensagem');

ALTER TABLE mensagem
  ADD CONSTRAINT mensagem_status_direcao CHECK (
    (direcao = 'entrada' AND status IN ('recebida', 'descartada'))
    OR (direcao = 'saida' AND status IN ('pendente', 'enviada', 'falhou', 'descartada'))
  ),
  ADD CONSTRAINT mensagem_telefone_formato CHECK (telefone ~ '^\d{10,15}$');

ALTER TABLE bot_sessao
  ADD CONSTRAINT bot_sessao_formato CHECK (jsonb_typeof(sessao) = 'object');

-- Webhook do WhatsApp: chega só com o nome da instância. O worker declara a instância na
-- transação (app.instancia_bot) e enxerga só aquela conexão, para descobrir a conta.
-- Depois disso trabalha dentro da conta (naConta), como sempre.
CREATE POLICY webhook_por_instancia ON bot_conexao
  FOR SELECT
  USING (instancia = nullif(current_setting('app.instancia_bot', true), ''));

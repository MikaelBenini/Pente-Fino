-- CreateEnum
CREATE TYPE "status_menu_bot" AS ENUM ('rascunho', 'publicado', 'arquivado');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'boas_vindas';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'fora_horario';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'nao_entendi';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'transferencia';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'encerramento';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'saida_avisos';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'volta_avisos';

-- DropForeignKey
ALTER TABLE "bot_no" DROP CONSTRAINT "bot_no_conta_id_fkey";

-- DropForeignKey
ALTER TABLE "bot_no" DROP CONSTRAINT "bot_no_pai_id_fkey";

-- DropForeignKey
ALTER TABLE "bot_no" DROP CONSTRAINT "bot_no_unidade_id_fkey";

-- AlterTable
ALTER TABLE "unidade" ADD COLUMN     "bot_horario" JSONB;

-- DropTable
DROP TABLE "bot_no";

-- DropEnum
DROP TYPE "tipo_no_bot";

-- CreateTable
CREATE TABLE "bot_menu" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "status" "status_menu_bot" NOT NULL,
    "menu" JSONB NOT NULL,
    "publicado_em" TIMESTAMPTZ(3),
    "publicado_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bot_menu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_menu_conta_id_status_idx" ON "bot_menu"("conta_id", "status");

-- AddForeignKey
ALTER TABLE "bot_menu" ADD CONSTRAINT "bot_menu_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_menu" ADD CONSTRAINT "bot_menu_publicado_por_id_fkey" FOREIGN KEY ("publicado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('bot_menu');

-- Uma versão em rascunho e uma publicada por conta; as anteriores ficam arquivadas.
CREATE UNIQUE INDEX "bot_menu_um_rascunho" ON "bot_menu"("conta_id") WHERE "status" = 'rascunho';
CREATE UNIQUE INDEX "bot_menu_um_publicado" ON "bot_menu"("conta_id") WHERE "status" = 'publicado';
-- O menu é sempre um objeto com o menu principal e as palavras-chave.
ALTER TABLE "bot_menu" ADD CONSTRAINT "bot_menu_formato"
  CHECK (jsonb_typeof("menu") = 'object' AND "menu" ? 'menu' AND "menu" ? 'palavrasChave');

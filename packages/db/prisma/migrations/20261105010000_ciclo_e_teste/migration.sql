-- CreateEnum
CREATE TYPE "ciclo_cobranca" AS ENUM ('mensal', 'anual');

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "ciclo" "ciclo_cobranca" NOT NULL DEFAULT 'mensal',
ADD COLUMN     "teste_ate" TIMESTAMPTZ(3);


-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'convite_retorno';
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'parabens';

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "automacoes" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "aniversario_enviado_em" TIMESTAMPTZ(3),
ADD COLUMN     "retorno_convidado_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "mensagem" ADD COLUMN     "automacao" TEXT;


CREATE INDEX mensagem_automacao_idx ON mensagem (conta_id, automacao, criado_em) WHERE automacao IS NOT NULL;

-- Rotina diária das automações (worker, sem login): declara app.rotina na transação e enxerga
-- só as contas com alguma automação ligada, para depois trabalhar dentro de cada uma (naConta).
CREATE POLICY conta_rotina_automacoes ON conta
  FOR SELECT
  USING (
    current_setting('app.rotina', true) = 'automacoes'
    AND (automacoes->>'retorno' = 'true' OR automacoes->>'aniversario' = 'true')
  );

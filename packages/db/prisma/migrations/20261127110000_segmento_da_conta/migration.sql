-- Fase 1a do plano multissegmento (27/11/2026): cada conta tem um segmento (ADR 0014), que define
-- o vocabulário (barbeiro, esteticista, instrutor...), o catálogo inicial e as funções ligadas
-- por padrão. As contas que já existem viram "barbearia": nada muda para elas.
--
-- Para desfazer: ALTER TABLE "conta" DROP COLUMN "funcoes", DROP COLUMN "segmento";
-- DROP TYPE "segmento";
CREATE TYPE "segmento" AS ENUM ('barbearia', 'salao', 'estetica', 'unhas', 'tatuagem', 'academia', 'personal', 'outro');

ALTER TABLE "conta"
  ADD COLUMN "segmento" "segmento" NOT NULL DEFAULT 'barbearia',
  -- Funções escolhidas pelo dono (pacotes, anamnese, check-in...); vazio (null) = o padrão do
  -- segmento (funcoesDaConta, no packages/shared).
  ADD COLUMN "funcoes" JSONB;

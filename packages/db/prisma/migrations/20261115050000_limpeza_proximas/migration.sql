-- Admin U9: a rotina da limpeza guarda as contas que vai apagar nos próximos 7 dias, para a
-- Saúde do sistema mostrar antes de acontecer.

-- AlterTable
ALTER TABLE "execucao_limpeza" ADD COLUMN "proximas" JSONB NOT NULL DEFAULT '[]';

-- Avaliação da conversa do chat (sugestão aprovada em 13/11): o visitante, ou o cliente da Ajuda,
-- diz se foi útil ao encerrar. A média aparece no resumo da aba Chat.

-- AlterTable
ALTER TABLE "conversa_suporte" ADD COLUMN "avaliacao" BOOLEAN;

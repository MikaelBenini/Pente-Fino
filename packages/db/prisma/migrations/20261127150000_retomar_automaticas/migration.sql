-- Retomar as automáticas pausadas (sugestão aprovada em 27/11/2026): os sinais de risco (SAIR,
-- falhas) passam a contar só depois que o dono retomou, para a pausa não voltar na hora.
-- Reversível: ALTER TABLE bot_conexao DROP COLUMN retomado_em.
ALTER TABLE "bot_conexao" ADD COLUMN "retomado_em" TIMESTAMPTZ(3);

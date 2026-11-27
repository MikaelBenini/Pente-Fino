-- Proteção dos números de WhatsApp (27/11/2026, packages/shared/src/protecao-whatsapp.ts).
-- Reversível: ALTER TABLE mensagem DROP COLUMN proativa; ALTER TABLE bot_conexao DROP COLUMN
-- conectado_em, DROP COLUMN pausado_ate, DROP COLUMN pausa_motivo.

-- Automática para quem não escreveu nas últimas 24 h: conta no limite diário do número.
ALTER TABLE "mensagem" ADD COLUMN "proativa" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "mensagem_proativas_idx" ON "mensagem" ("unidade_id", "enviada_em") WHERE "proativa";

-- Quando o número atual foi conectado (aquecimento) e a pausa das automáticas por risco.
ALTER TABLE "bot_conexao" ADD COLUMN "conectado_em" TIMESTAMPTZ(3);
ALTER TABLE "bot_conexao" ADD COLUMN "pausado_ate" TIMESTAMPTZ(3);
ALTER TABLE "bot_conexao" ADD COLUMN "pausa_motivo" TEXT;

-- Números que já estão conectados contam desde a criação da conexão (já estão em uso).
UPDATE "bot_conexao" SET "conectado_em" = "criado_em" WHERE "status" = 'conectado';

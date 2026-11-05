-- Regras de agendamento por unidade (bot e site); vazio = padrão do sistema.
ALTER TABLE "unidade" ADD COLUMN "regras_agendamento" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "unidade"
  ADD CONSTRAINT unidade_regras_agendamento_objeto CHECK (jsonb_typeof(regras_agendamento) = 'object');

-- Horário de funcionamento da unidade (pedido do dono em 13/11): turnos por dia da semana, em
-- minutos. O agendamento só oferece horário dentro deles; vazio = como antes.
ALTER TABLE "unidade" ADD COLUMN "horario_funcionamento" JSONB NOT NULL DEFAULT '[]';

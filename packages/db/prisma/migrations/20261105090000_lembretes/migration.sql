-- Lembretes do horário pelo WhatsApp (24 h e 2 h antes) e a confirmação do cliente.
ALTER TABLE "agendamento"
  ADD COLUMN "lembrete_24h_em" TIMESTAMPTZ(3),
  ADD COLUMN "lembrete_2h_em" TIMESTAMPTZ(3),
  ADD COLUMN "confirmado_em" TIMESTAMPTZ(3);

-- Confirmado pelo cliente tem a data da confirmação.
ALTER TABLE "agendamento"
  ADD CONSTRAINT agendamento_confirmado_tem_data
  CHECK (status <> 'confirmado' OR confirmado_em IS NOT NULL);

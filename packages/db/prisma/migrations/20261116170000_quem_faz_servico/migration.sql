-- Quem faz cada serviço (P5, lote 7g): os serviços de cada barbeiro. Vazio = faz todos.
ALTER TABLE "profissional" ADD COLUMN "servico_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

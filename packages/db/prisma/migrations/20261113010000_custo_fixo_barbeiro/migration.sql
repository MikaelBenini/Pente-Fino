-- Relatório do mês (Etapa 23.1): valor fixo por mês do barbeiro além da comissão (salário, ajuda
-- de custo), para o custo dele no relatório não ser só a comissão.
ALTER TABLE "profissional" ADD COLUMN "custo_fixo_mensal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "profissional" ADD CONSTRAINT profissional_custo_fixo_nao_negativo CHECK (custo_fixo_mensal >= 0);

-- Preço livre na comanda (pedido do dono em 11/11/2026): o serviço liga "preço livre" (química),
-- com faixa opcional; a conta escolhe se o barbeiro também digita o valor.

-- AlterTable
ALTER TABLE "servico" ADD COLUMN "preco_livre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preco_minimo" INTEGER,
ADD COLUMN "preco_maximo" INTEGER;

ALTER TABLE "servico" ADD CONSTRAINT "servico_faixa_preco_livre_check"
  CHECK ("preco_minimo" IS NULL OR "preco_maximo" IS NULL OR "preco_minimo" <= "preco_maximo");

-- AlterTable
ALTER TABLE "conta" ADD COLUMN "preco_livre_barbeiro" BOOLEAN NOT NULL DEFAULT false;

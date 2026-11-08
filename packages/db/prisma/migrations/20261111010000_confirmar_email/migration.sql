-- Confirmação do e-mail no cadastro pelo site (Etapa 15.4).
-- A coluna nasce com o padrão now(): quem já existe (e quem entra por convite, venda ou
-- demonstração) fica confirmado. O cadastro pelo site grava null até a pessoa clicar no link.

-- AlterEnum
ALTER TYPE "tipo_token" ADD VALUE 'confirmar_email';

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "email_confirmado_em" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP;

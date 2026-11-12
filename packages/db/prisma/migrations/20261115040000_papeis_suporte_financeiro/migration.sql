-- Admin U6: papéis Suporte (lê contas e a saúde do sistema, sem cobrança nem configurações) e
-- Financeiro (cobrança e nota fiscal, sem equipe), e a data da última troca de senha.

-- AlterEnum
ALTER TYPE "papel_plataforma" ADD VALUE 'suporte';
ALTER TYPE "papel_plataforma" ADD VALUE 'financeiro';

-- AlterTable
ALTER TABLE "usuario_plataforma" ADD COLUMN "senha_trocada_em" TIMESTAMPTZ(3);
UPDATE "usuario_plataforma" SET "senha_trocada_em" = "criado_em" WHERE "senha_trocada_em" IS NULL;

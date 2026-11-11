-- Painel P4 (decisão do dono, padrão do briefing): a página da unidade (/b/slug) só entra no Google
-- quando o dono liga "Aparecer no Google". Desligado, a página tem noindex e fica fora do sitemap.

-- AlterTable
ALTER TABLE "unidade" ADD COLUMN     "aparecer_no_google" BOOLEAN NOT NULL DEFAULT false;


-- E-mail para a barbearia parada na mesma etapa do funil (admin F1d): a rotina da administração
-- guarda a etapa de cada conta, desde quando, e se o e-mail de ajuda desta etapa já saiu.
-- Tabela só da administração: conta_afetada_id (não conta_id), como nota_interna_conta.

-- CreateTable
CREATE TABLE "funil_etapa_conta" (
    "conta_afetada_id" UUID NOT NULL,
    "etapa" TEXT NOT NULL,
    "desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avisado_em" TIMESTAMPTZ(3),

    CONSTRAINT "funil_etapa_conta_pkey" PRIMARY KEY ("conta_afetada_id")
);

-- AddForeignKey
ALTER TABLE "funil_etapa_conta" ADD CONSTRAINT "funil_etapa_conta_conta_afetada_id_fkey" FOREIGN KEY ("conta_afetada_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Só a administração lê e grava; a aplicação das barbearias não enxerga.
REVOKE ALL ON funil_etapa_conta FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, UPDATE, DELETE ON funil_etapa_conta TO pente_fino_plataforma;

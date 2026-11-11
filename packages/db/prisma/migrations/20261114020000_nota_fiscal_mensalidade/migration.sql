-- Nota fiscal de cada mensalidade (admin R2): o webhook do Asaas grava a situação, o número e o
-- PDF. A barbearia vê a nota na fatura; a administração vê, na Saúde do sistema, a última
-- emitida e as que não saíram.

-- CreateEnum
CREATE TYPE "status_nota_fiscal" AS ENUM ('agendada', 'enviada', 'emitida', 'erro', 'cancelando', 'cancelada');

-- CreateTable
CREATE TABLE "nota_fiscal_mensalidade" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "id_externo" TEXT NOT NULL,
    "pagamento_id" TEXT,
    "status" "status_nota_fiscal" NOT NULL,
    "numero" TEXT,
    "valor" INTEGER,
    "pdf_url" TEXT,
    "xml_url" TEXT,
    "mensagem" TEXT,
    "emitida_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nota_fiscal_mensalidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nota_fiscal_mensalidade_id_externo_key" ON "nota_fiscal_mensalidade"("id_externo");

-- CreateIndex
CREATE INDEX "nota_fiscal_mensalidade_conta_id_pagamento_id_idx" ON "nota_fiscal_mensalidade"("conta_id", "pagamento_id");

-- AddForeignKey
ALTER TABLE "nota_fiscal_mensalidade" ADD CONSTRAINT "nota_fiscal_mensalidade_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('nota_fiscal_mensalidade');

-- Leitura entre contas só para o dono das tabelas, ou seja, só dentro das funções SECURITY
-- DEFINER abaixo (o mesmo de fatura_assinatura na migração plataforma_metricas).
DO $$
BEGIN
  EXECUTE format(
    'CREATE POLICY plataforma_leitura ON nota_fiscal_mensalidade FOR SELECT USING (current_user = %L)',
    current_user
  );
END
$$;

-- Saúde do sistema: notas de todas as contas, só o que a administração precisa (sem PDF).
CREATE FUNCTION plataforma_notas_fiscais(p_desde timestamptz)
  RETURNS TABLE (
    conta text,
    status status_nota_fiscal,
    numero text,
    mensagem text,
    atualizado_em timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT c.nome, n.status, n.numero, n.mensagem, n.atualizado_em
      FROM nota_fiscal_mensalidade n
      JOIN conta c ON c.id = n.conta_id
     WHERE n.atualizado_em >= p_desde OR n.status IN ('agendada', 'enviada')
     ORDER BY n.atualizado_em DESC
     LIMIT 200
  $$;
REVOKE ALL ON FUNCTION plataforma_notas_fiscais(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_notas_fiscais(timestamptz) TO pente_fino_plataforma;

-- Última nota emitida, mesmo antiga (a Saúde mostra "a última saiu em …").
CREATE FUNCTION plataforma_ultima_nota_emitida()
  RETURNS TABLE (conta text, numero text, emitida_em timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT c.nome, n.numero, coalesce(n.emitida_em, n.atualizado_em)
      FROM nota_fiscal_mensalidade n
      JOIN conta c ON c.id = n.conta_id
     WHERE n.status = 'emitida'
     ORDER BY coalesce(n.emitida_em, n.atualizado_em) DESC
     LIMIT 1
  $$;
REVOKE ALL ON FUNCTION plataforma_ultima_nota_emitida() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_ultima_nota_emitida() TO pente_fino_plataforma;

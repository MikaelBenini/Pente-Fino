-- Preço por barbeiro (detalhe do dono em 12/11/2026): os serviços e a tabela continuam da unidade;
-- o barbeiro muda o próprio preço de um serviço no perfil dele. Vale quando marcam com ele e na
-- comanda dele. Com vigência, como a tabela; valor nulo = volta para o preço da unidade.

-- CreateTable
CREATE TABLE "preco_profissional" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "profissional_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "valor" INTEGER,
    "vigencia_inicio" DATE NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "preco_profissional_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "preco_profissional_valor_check" CHECK ("valor" IS NULL OR "valor" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "preco_profissional_conta_id_profissional_id_servico_id_vigen_ke" ON "preco_profissional"("conta_id", "profissional_id", "servico_id", "vigencia_inicio");

-- AddForeignKey
ALTER TABLE "preco_profissional" ADD CONSTRAINT "preco_profissional_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preco_profissional" ADD CONSTRAINT "preco_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preco_profissional" ADD CONSTRAINT "preco_profissional_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SELECT habilitar_isolamento_conta('preco_profissional');

-- Preço que vale para o profissional: o dele (o mais recente até a data, se não for nulo) ou o
-- da unidade.
CREATE FUNCTION preco_do_profissional(p_servico_id uuid, p_profissional_id uuid, p_unidade_id uuid, p_data date)
  RETURNS integer
  LANGUAGE sql STABLE
  AS $$
    SELECT COALESCE(
      (SELECT valor
         FROM preco_profissional
        WHERE servico_id = p_servico_id
          AND profissional_id = p_profissional_id
          AND vigencia_inicio <= p_data
        ORDER BY vigencia_inicio DESC
        LIMIT 1),
      preco_servico_vigente(p_servico_id, p_unidade_id, p_data)
    )
  $$;

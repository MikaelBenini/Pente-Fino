-- Fotos do site da barbearia (seção 7, lote 7c). O arquivo fica no disco do servidor; a tabela
-- diz de qual conta e unidade é a foto (o site só aceita foto da própria conta) e o tamanho dela.

-- CreateTable
CREATE TABLE "foto_site" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "largura" INTEGER NOT NULL,
    "altura" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foto_site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foto_site_conta_id_idx" ON "foto_site"("conta_id");
CREATE INDEX "foto_site_unidade_id_idx" ON "foto_site"("unidade_id");

-- AddForeignKey
ALTER TABLE "foto_site" ADD CONSTRAINT "foto_site_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "foto_site" ADD CONSTRAINT "foto_site_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SELECT habilitar_isolamento_conta('foto_site');

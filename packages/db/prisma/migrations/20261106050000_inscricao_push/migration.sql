-- CreateTable
CREATE TABLE "inscricao_push" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "aparelho" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricao_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inscricao_push_usuario_id_idx" ON "inscricao_push"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_push_conta_id_endpoint_key" ON "inscricao_push"("conta_id", "endpoint");

-- AddForeignKey
ALTER TABLE "inscricao_push" ADD CONSTRAINT "inscricao_push_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricao_push" ADD CONSTRAINT "inscricao_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('inscricao_push');

-- CreateTable
CREATE TABLE "assistente_equipe" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "telefone" TEXT,
    "codigo_hash" TEXT,
    "codigo_expira_em" TIMESTAMPTZ(3),
    "confirmado_em" TIMESTAMPTZ(3),
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "avisos" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistente_equipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistente_equipe_usuario_id_key" ON "assistente_equipe"("usuario_id");

-- CreateIndex
CREATE INDEX "assistente_equipe_conta_id_idx" ON "assistente_equipe"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "assistente_equipe_unidade_id_telefone_key" ON "assistente_equipe"("unidade_id", "telefone");

-- AddForeignKey
ALTER TABLE "assistente_equipe" ADD CONSTRAINT "assistente_equipe_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_equipe" ADD CONSTRAINT "assistente_equipe_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistente_equipe" ADD CONSTRAINT "assistente_equipe_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('assistente_equipe');

ALTER TABLE "assistente_equipe"
  ADD CONSTRAINT assistente_telefone_formato CHECK (telefone IS NULL OR telefone ~ '^\d{10,15}$'),
  ADD CONSTRAINT assistente_confirmado_tem_telefone CHECK (confirmado_em IS NULL OR telefone IS NOT NULL),
  ADD CONSTRAINT assistente_avisos_objeto CHECK (jsonb_typeof(avisos) = 'object');

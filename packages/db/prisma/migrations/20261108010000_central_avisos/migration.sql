-- AlterTable
ALTER TABLE "comanda" ADD COLUMN     "pendente_avisada_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "aviso" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID NOT NULL,
    "unidade_id" UUID,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "link" TEXT,
    "chave" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lido_em" TIMESTAMPTZ(3),

    CONSTRAINT "aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aviso_usuario_id_criado_em_idx" ON "aviso"("usuario_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "aviso_usuario_id_chave_key" ON "aviso"("usuario_id", "chave");

-- AddForeignKey
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Isolamento por conta.
SELECT habilitar_isolamento_conta('aviso');

-- Rotina dos avisos (comandas pendentes a cada 15 min): o worker lista as contas sem entrar em
-- nenhuma; o trabalho de cada conta roda dentro dela (naConta).
CREATE POLICY conta_rotina_avisos ON conta
  FOR SELECT
  USING (current_setting('app.rotina', true) = 'avisos');

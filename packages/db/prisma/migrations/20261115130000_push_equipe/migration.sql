-- Push da equipe da plataforma (admin F6): conversa e mensagem nova do chat chegam no celular, mesmo
-- com o navegador fechado. Só a administração lê e grava.

-- CreateTable
CREATE TABLE "inscricao_push_plataforma" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "usuario_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "aparelho" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricao_push_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_push_plataforma_endpoint_key" ON "inscricao_push_plataforma"("endpoint");

-- CreateIndex
CREATE INDEX "inscricao_push_plataforma_usuario_id_idx" ON "inscricao_push_plataforma"("usuario_id");

-- AddForeignKey
ALTER TABLE "inscricao_push_plataforma" ADD CONSTRAINT "inscricao_push_plataforma_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario_plataforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;


REVOKE ALL ON inscricao_push_plataforma FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, UPDATE, DELETE ON inscricao_push_plataforma TO pente_fino_plataforma;

-- Chat do site com a equipe do Pente Fino (admin F6, entrega 1): conversas e mensagens. Tabelas só
-- da administração: a aplicação das barbearias não enxerga; a API usa o usuário da plataforma.

-- CreateEnum
CREATE TYPE "status_conversa_suporte" AS ENUM ('fila', 'atendendo', 'encerrada');


-- CreateTable
CREATE TABLE "conversa_suporte" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "status" "status_conversa_suporte" NOT NULL DEFAULT 'fila',
    "nome" TEXT NOT NULL,
    "contato" TEXT NOT NULL,
    "pagina" TEXT,
    "token_hash" TEXT NOT NULL,
    "atendente_id" UUID,
    "conta_afetada_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assumida_em" TIMESTAMPTZ(3),
    "encerrada_em" TIMESTAMPTZ(3),
    "ultima_mensagem_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversa_suporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagem_suporte" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conversa_id" UUID NOT NULL,
    "de" TEXT NOT NULL,
    "autor_id" UUID,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagem_suporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversa_suporte_token_hash_key" ON "conversa_suporte"("token_hash");

-- CreateIndex
CREATE INDEX "conversa_suporte_status_ultima_mensagem_em_idx" ON "conversa_suporte"("status", "ultima_mensagem_em");

-- CreateIndex
CREATE INDEX "mensagem_suporte_conversa_id_criado_em_idx" ON "mensagem_suporte"("conversa_id", "criado_em");

-- AddForeignKey
ALTER TABLE "conversa_suporte" ADD CONSTRAINT "conversa_suporte_atendente_id_fkey" FOREIGN KEY ("atendente_id") REFERENCES "usuario_plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem_suporte" ADD CONSTRAINT "mensagem_suporte_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversa_suporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem_suporte" ADD CONSTRAINT "mensagem_suporte_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario_plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;


REVOKE ALL ON conversa_suporte, mensagem_suporte FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversa_suporte, mensagem_suporte TO pente_fino_plataforma;

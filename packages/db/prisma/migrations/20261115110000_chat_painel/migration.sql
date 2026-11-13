-- Chat também na Ajuda do painel (admin F6): a conversa guarda de onde veio (site ou painel) e,
-- no painel, o usuário da barbearia que abriu (para ele continuar a mesma conversa).

-- AlterTable
ALTER TABLE "conversa_suporte" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'site',
ADD COLUMN "usuario_painel_id" UUID;

-- CreateIndex
CREATE INDEX "conversa_suporte_usuario_painel_id_criado_em_idx" ON "conversa_suporte"("usuario_painel_id", "criado_em");

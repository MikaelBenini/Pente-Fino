-- CreateEnum
CREATE TYPE "tipo_token" AS ENUM ('renovacao', 'redefinir_senha', 'convite');

-- CreateTable
CREATE TABLE "token_acesso" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID NOT NULL,
    "tipo" "tipo_token" NOT NULL,
    "hash" TEXT NOT NULL,
    "familia" UUID,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "revogado_em" TIMESTAMPTZ(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_acesso_hash_key" ON "token_acesso"("hash");

-- CreateIndex
CREATE INDEX "token_acesso_conta_id_idx" ON "token_acesso"("conta_id");

-- CreateIndex
CREATE INDEX "token_acesso_usuario_id_tipo_idx" ON "token_acesso"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "token_acesso_familia_idx" ON "token_acesso"("familia");

-- AddForeignKey
ALTER TABLE "token_acesso" ADD CONSTRAINT "token_acesso_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_acesso" ADD CONSTRAINT "token_acesso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Escrito à mão ────────────────────────────────────────────────────────

SELECT habilitar_isolamento_conta('token_acesso');

-- Login: a API ainda não sabe a conta, só o e-mail digitado. Ela declara o e-mail na
-- transação (set_config('app.login_email', ..., true)) e enxerga só esse usuário.
-- Políticas permissivas somam (OR) com isolamento_conta; só leitura.
CREATE POLICY login_por_email ON usuario
  FOR SELECT
  USING (email = nullif(current_setting('app.login_email', true), ''));

-- Renovação, convite e redefinição: o token chega sem conta; a API declara o hash
-- (app.token_hash) e enxerga só esse token. Gravações seguem exigindo a conta.
CREATE POLICY busca_por_hash ON token_acesso
  FOR SELECT
  USING (hash = nullif(current_setting('app.token_hash', true), ''));

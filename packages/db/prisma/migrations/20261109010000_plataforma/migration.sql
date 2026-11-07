-- CreateEnum
CREATE TYPE "papel_plataforma" AS ENUM ('admin', 'vendedor');

-- CreateTable
CREATE TABLE "usuario_plataforma" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "papel_plataforma" NOT NULL,
    "totp_segredo" TEXT,
    "totp_confirmado_em" TIMESTAMPTZ(3),
    "totp_ultimo_passo" BIGINT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acesso_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao_plataforma" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "navegador" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "encerrada_em" TIMESTAMPTZ(3),

    CONSTRAINT "sessao_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_plataforma" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "usuario_id" UUID,
    "acao" TEXT NOT NULL,
    "conta_afetada_id" UUID,
    "antes" JSONB,
    "depois" JSONB,
    "motivo" TEXT,
    "ip" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_plataforma_email_key" ON "usuario_plataforma"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_plataforma_token_hash_key" ON "sessao_plataforma"("token_hash");

-- CreateIndex
CREATE INDEX "sessao_plataforma_usuario_id_idx" ON "sessao_plataforma"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_plataforma_conta_afetada_id_idx" ON "auditoria_plataforma"("conta_afetada_id");

-- CreateIndex
CREATE INDEX "auditoria_plataforma_criado_em_idx" ON "auditoria_plataforma"("criado_em");

-- AddForeignKey
ALTER TABLE "sessao_plataforma" ADD CONSTRAINT "sessao_plataforma_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario_plataforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_plataforma" ADD CONSTRAINT "auditoria_plataforma_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario_plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Escrito à mão: quem acessa as tabelas da plataforma ──────────────────
-- O usuário da aplicação (barbearias) não toca nas tabelas da plataforma; o da plataforma
-- (pente_fino_plataforma, criado no init do PostgreSQL) só nelas e nas funções abaixo.
REVOKE ALL ON usuario_plataforma, sessao_plataforma, auditoria_plataforma FROM pente_fino_aplicacao;
GRANT USAGE ON SCHEMA public TO pente_fino_plataforma;
GRANT SELECT, INSERT, UPDATE ON usuario_plataforma, sessao_plataforma TO pente_fino_plataforma;
GRANT SELECT, INSERT ON auditoria_plataforma TO pente_fino_plataforma;

-- Auditoria da plataforma imutável, como a das barbearias.
CREATE TRIGGER auditoria_plataforma_imutavel
  BEFORE UPDATE OR DELETE ON auditoria_plataforma
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();
CREATE TRIGGER auditoria_plataforma_sem_truncate
  BEFORE TRUNCATE ON auditoria_plataforma
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_imutavel();

-- ─── Leitura entre contas, sem furar o RLS das barbearias ─────────────────
-- As funções abaixo são SECURITY DEFINER: rodam como o dono das tabelas (quem roda esta
-- migração). As políticas "plataforma_leitura" valem só para esse papel, então só dentro das
-- funções se lê entre contas; o usuário da aplicação continua preso à própria conta, e o da
-- plataforma não lê tabela de barbearia direto, só o que as funções devolvem (contagens,
-- plano, situação e datas; nunca cliente, comanda ou conversa).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conta', 'unidade', 'profissional', 'bot_conexao', 'comanda'] LOOP
    EXECUTE format(
      'CREATE POLICY plataforma_leitura ON %I FOR SELECT USING (current_user = %L)',
      t, current_user
    );
  END LOOP;
END
$$;

-- Lista de contas para a administração: dados da assinatura e uso, sem dado de cliente.
CREATE FUNCTION plataforma_contas()
  RETURNS TABLE (
    id uuid,
    nome text,
    plano plano,
    ciclo ciclo_cobranca,
    status status_conta,
    criado_em timestamptz,
    teste_ate timestamptz,
    configurada_em timestamptz,
    cobranca_automatica boolean,
    unidades integer,
    profissionais integer,
    whatsapp_conectado boolean,
    fechadas_7_dias integer,
    ultima_fechada_em timestamptz
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT
      c.id,
      c.nome,
      c.plano,
      c.ciclo,
      c.status,
      c.criado_em,
      c.teste_ate,
      c.configurada_em,
      c.asaas_assinatura_id IS NOT NULL,
      (SELECT count(*)::int FROM unidade u WHERE u.conta_id = c.id AND u.ativa),
      (SELECT count(*)::int FROM profissional p WHERE p.conta_id = c.id AND p.ativo),
      EXISTS (SELECT 1 FROM bot_conexao b WHERE b.conta_id = c.id AND b.status = 'conectado'),
      (SELECT count(*)::int FROM comanda m
         WHERE m.conta_id = c.id AND m.status = 'fechada' AND m.fechada_em > now() - interval '7 days'),
      (SELECT max(m.fechada_em) FROM comanda m WHERE m.conta_id = c.id AND m.status = 'fechada')
    FROM conta c
    ORDER BY c.criado_em DESC
  $$;

REVOKE ALL ON FUNCTION plataforma_contas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_contas() TO pente_fino_plataforma;

-- Alertas para a equipe da plataforma (admin F3): cada pessoa escolhe os tipos que recebe por
-- e-mail, e cada alerta sai uma vez só. Os admins de hoje começam recebendo todos.

-- AlterTable
ALTER TABLE "usuario_plataforma" ADD COLUMN "alertas" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE usuario_plataforma
   SET alertas = ARRAY['cadastro_novo', 'teste_acabando', 'cobranca_vencida', 'whatsapp_caido',
                       'falha_email', 'falha_nf', 'cupom_esgotando']
 WHERE papel = 'admin';

-- CreateTable
CREATE TABLE "alerta_equipe_enviado" (
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "enviado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_equipe_enviado_pkey" PRIMARY KEY ("tipo","chave")
);

-- Só a administração (e a rotina dela no worker, com o mesmo usuário) lê e grava.
REVOKE ALL ON alerta_equipe_enviado FROM pente_fino_aplicacao;
GRANT SELECT, INSERT, DELETE ON alerta_equipe_enviado TO pente_fino_plataforma;

-- WhatsApp que caiu sem o dono pedir e ainda não voltou, em todas as contas (a política de leitura
-- de bot_conexao já vale dentro das funções SECURITY DEFINER, como em plataforma_contas()).
CREATE FUNCTION plataforma_whatsapp_caido()
  RETURNS TABLE (conta_id uuid, conta text, caiu_em timestamptz)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT b.conta_id, c.nome, min(b.caiu_em)
      FROM bot_conexao b
      JOIN conta c ON c.id = b.conta_id
     WHERE b.status <> 'conectado' AND b.caiu_em IS NOT NULL
     GROUP BY b.conta_id, c.nome
  $$;
REVOKE ALL ON FUNCTION plataforma_whatsapp_caido() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_whatsapp_caido() TO pente_fino_plataforma;

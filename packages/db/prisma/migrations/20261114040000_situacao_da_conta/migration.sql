-- Situação da conta na administração (admin R3, R4 e R6). Bloquear guarda o que a conta era e
-- desbloquear volta a isso; cancelar tem o par reativar, que sempre diz o próximo passo (teste,
-- cobrança a partir de uma data ou cortesia). A regra fica em packages/shared
-- (situacao-conta.ts); o banco só grava o que ela decidiu.

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "cobrar_a_partir_de" DATE,
ADD COLUMN     "cortesia_ate" DATE,
ADD COLUMN     "status_anterior" "status_conta";

-- O que a regra precisa saber da conta (sem dado de cliente).
CREATE FUNCTION plataforma_conta_situacao(p_conta uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  r jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object(
           'status', status,
           'statusAnterior', status_anterior,
           'testeAte', teste_ate,
           'cortesiaAte', cortesia_ate,
           'cobrarAPartirDe', cobrar_a_partir_de,
           'canceladaEm', cancelada_em,
           'asaasAssinaturaId', asaas_assinatura_id)
    INTO r FROM conta WHERE id = p_conta;
  RETURN r;
END
$$;

-- Grava a mudança decidida pela regra e devolve como estava (para a auditoria). Chaves ausentes
-- em p_mudanca ficam como estão; presentes com null limpam.
CREATE FUNCTION plataforma_aplicar_situacao(p_conta uuid, p_mudanca jsonb, p_motivo text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  antes jsonb;
BEGIN
  antes := plataforma_conta_situacao(p_conta);
  IF antes IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  PERFORM set_config('app.conta_id', p_conta::text, true);
  UPDATE conta SET
    status = (p_mudanca->>'status')::status_conta,
    status_anterior = (p_mudanca->>'statusAnterior')::status_conta,
    teste_ate = CASE WHEN p_mudanca ? 'testeAte'
                     THEN ((p_mudanca->>'testeAte') || 'T23:59:59-03:00')::timestamptz
                     ELSE teste_ate END,
    cortesia_ate = CASE WHEN p_mudanca ? 'cortesiaAte'
                        THEN (p_mudanca->>'cortesiaAte')::date ELSE cortesia_ate END,
    cobrar_a_partir_de = CASE WHEN p_mudanca ? 'cobrarAPartirDe'
                              THEN (p_mudanca->>'cobrarAPartirDe')::date ELSE cobrar_a_partir_de END,
    cancelada_em = CASE p_mudanca->>'cancelamento'
                     WHEN 'marcar' THEN now() WHEN 'limpar' THEN NULL ELSE cancelada_em END,
    motivo_cancelamento = CASE p_mudanca->>'cancelamento'
                            WHEN 'marcar' THEN p_motivo WHEN 'limpar' THEN NULL
                            ELSE motivo_cancelamento END,
    -- A cobrança automática foi cancelada no Asaas: a conta passa à cobrança manual.
    asaas_assinatura_id = CASE WHEN (p_mudanca->>'pararCobrancaAutomatica')::boolean
                               THEN NULL ELSE asaas_assinatura_id END,
    atualizado_em = now()
  WHERE id = p_conta;
  RETURN antes;
END
$$;

-- A função antiga decidia sozinha ("desbloquear" = ativa, mesmo de cancelada): sai.
DROP FUNCTION plataforma_mudar_situacao(uuid, status_conta, text);

REVOKE ALL ON FUNCTION plataforma_conta_situacao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION plataforma_aplicar_situacao(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_conta_situacao(uuid) TO pente_fino_plataforma;
GRANT EXECUTE ON FUNCTION plataforma_aplicar_situacao(uuid, jsonb, text) TO pente_fino_plataforma;

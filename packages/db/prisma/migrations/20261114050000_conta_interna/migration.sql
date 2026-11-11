-- Indicadores da administração (admin R5). Conta interna (testes, demonstração, implantação)
-- fica fora do MRR, das métricas, do "Precisa de atenção" e da cobrança manual; a lista de
-- contas passa a trazer a marca, a cortesia e o início da cobrança.

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "interna" BOOLEAN NOT NULL DEFAULT false;

-- A lista ganha colunas: o tipo de retorno muda, então a função é recriada.
DROP FUNCTION plataforma_contas();
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
    cancelada_em timestamptz,
    motivo_cancelamento text,
    vendedor_id uuid,
    precos_desde date,
    cupom text,
    desconto_bp integer,
    dono_ativou boolean,
    unidades integer,
    profissionais integer,
    whatsapp_conectado boolean,
    fechadas_7_dias integer,
    ultima_fechada_em timestamptz,
    ultimo_acesso_em timestamptz,
    interna boolean,
    cortesia_ate date,
    cobrar_a_partir_de date
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
      c.cancelada_em,
      c.motivo_cancelamento,
      c.vendedor_id,
      c.precos_desde,
      c.cupom,
      c.desconto_bp,
      -- O dono criou a senha (aceitou o convite ou se cadastrou pelo site).
      EXISTS (SELECT 1 FROM token_acesso t
               WHERE t.conta_id = c.id AND t.tipo = 'renovacao'),
      (SELECT count(*)::int FROM unidade u WHERE u.conta_id = c.id AND u.ativa),
      (SELECT count(*)::int FROM profissional p WHERE p.conta_id = c.id AND p.ativo),
      EXISTS (SELECT 1 FROM bot_conexao b WHERE b.conta_id = c.id AND b.status = 'conectado'),
      (SELECT count(*)::int FROM comanda m
         WHERE m.conta_id = c.id AND m.status = 'fechada' AND m.fechada_em > now() - interval '7 days'),
      (SELECT max(m.fechada_em) FROM comanda m WHERE m.conta_id = c.id AND m.status = 'fechada'),
      (SELECT max(t.criado_em) FROM token_acesso t WHERE t.conta_id = c.id AND t.tipo = 'renovacao'),
      c.interna,
      c.cortesia_ate,
      c.cobrar_a_partir_de
    FROM conta c
    ORDER BY c.criado_em DESC
  $$;
REVOKE ALL ON FUNCTION plataforma_contas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_contas() TO pente_fino_plataforma;

-- A ficha também mostra a marca.
CREATE OR REPLACE FUNCTION plataforma_conta_situacao(p_conta uuid)
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
           'asaasAssinaturaId', asaas_assinatura_id,
           'interna', interna)
    INTO r FROM conta WHERE id = p_conta;
  RETURN r;
END
$$;

-- Marcar ou desmarcar como interna; devolve como era (para a auditoria).
CREATE FUNCTION plataforma_marcar_interna(p_conta uuid, p_interna boolean)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  antes boolean;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT interna INTO antes FROM conta WHERE id = p_conta;
  IF antes IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  UPDATE conta SET interna = p_interna, atualizado_em = now() WHERE id = p_conta;
  RETURN antes;
END
$$;
REVOKE ALL ON FUNCTION plataforma_marcar_interna(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_marcar_interna(uuid, boolean) TO pente_fino_plataforma;

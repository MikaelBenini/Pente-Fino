-- Licença da conta (ADR 0015, aprovada pelo dono em 27/11/2026): o produto contratado define a
-- tabela de preços e o que o sistema traz; o segmento continua definindo o vocabulário.
-- Reversível: DROP FUNCTION plataforma_mudar_licenca; ALTER TABLE conta DROP COLUMN licenca;
-- DROP TYPE licenca (e a plataforma_conta da migração anterior).
CREATE TYPE "licenca" AS ENUM ('barbearia', 'beleza', 'estetica', 'tatuagem', 'fitness', 'atendimento');

ALTER TABLE "conta" ADD COLUMN "licenca" "licenca" NOT NULL DEFAULT 'barbearia';

-- Quem já escolheu um segmento ganha a licença dele (igual a licencaDoSegmento no shared).
UPDATE conta SET licenca = CASE segmento::text
  WHEN 'salao' THEN 'beleza'
  WHEN 'unhas' THEN 'beleza'
  WHEN 'estetica' THEN 'estetica'
  WHEN 'tatuagem' THEN 'tatuagem'
  WHEN 'academia' THEN 'fitness'
  WHEN 'personal' THEN 'fitness'
  ELSE 'barbearia'
END::licenca;

-- A ficha da conta na administração mostra a licença e o segmento.
CREATE OR REPLACE FUNCTION public.plataforma_conta(p_conta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'plano', c.plano,
    'licenca', c.licenca,
    'segmento', c.segmento,
    'ciclo', c.ciclo,
    'status', c.status,
    'criadaEm', c.criado_em,
    'testeAte', c.teste_ate,
    'configuradaEm', c.configurada_em,
    'cobrancaAutomatica', c.asaas_assinatura_id IS NOT NULL,
    'documento', c.documento,
    'canceladaEm', c.cancelada_em,
    'motivoCancelamento', c.motivo_cancelamento,
    'precosDesde', c.precos_desde,
    'cupom', c.cupom,
    'descontoBp', c.desconto_bp,
    'donos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', u.nome, 'email', u.email, 'telefone', u.telefone) ORDER BY u.nome)
        FROM usuario u
       WHERE u.conta_id = p_conta AND u.ativo
         AND EXISTS (SELECT 1 FROM papel_usuario p
                      WHERE p.conta_id = p_conta AND p.usuario_id = u.id AND p.papel = 'dono')
    ), '[]'::jsonb),
    'unidades', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', un.nome, 'ativa', un.ativa) ORDER BY un.criado_em)
        FROM unidade un WHERE un.conta_id = p_conta
    ), '[]'::jsonb),
    'profissionais', (SELECT count(*) FROM profissional pr WHERE pr.conta_id = p_conta AND pr.ativo),
    'faturas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'plano', f.plano, 'ciclo', f.ciclo, 'valor', f.valor, 'status', f.status, 'origem', f.origem,
        'forma', f.forma, 'vencimento', f.vencimento, 'periodoInicio', f.periodo_inicio,
        'periodoFim', f.periodo_fim, 'pagaEm', f.paga_em, 'comprovante', f.comprovante
      ) ORDER BY f.vencimento DESC)
        FROM fatura_assinatura f WHERE f.conta_id = p_conta
    ), '[]'::jsonb)
  ) INTO r
  FROM conta c WHERE c.id = p_conta;
  RETURN r;
END
$function$;
;

-- Só a administração troca a licença (e o segmento junto): devolve o que era (auditoria) e o que
-- a cobrança precisa para o Asaas cobrar o preço da licença nova.
CREATE FUNCTION plataforma_mudar_licenca(p_conta uuid, p_licenca licenca, p_segmento segmento)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  antes jsonb;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT jsonb_build_object('licenca', licenca, 'segmento', segmento, 'plano', plano, 'ciclo', ciclo,
         'asaasAssinaturaId', asaas_assinatura_id, 'automacoes', automacoes_contratadas,
         'unidades', (SELECT count(*) FROM unidade WHERE conta_id = p_conta AND ativa))
    INTO antes FROM conta WHERE id = p_conta;
  IF antes IS NULL THEN RAISE EXCEPTION 'conta_inexistente'; END IF;
  UPDATE conta SET licenca = p_licenca, segmento = p_segmento, atualizado_em = now()
   WHERE id = p_conta;
  RETURN antes;
END
$$;

REVOKE ALL ON FUNCTION plataforma_mudar_licenca(uuid, licenca, segmento) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_mudar_licenca(uuid, licenca, segmento) TO pente_fino_plataforma;

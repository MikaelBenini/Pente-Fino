-- De onde veio o cadastro (site T2 e admin F2): parâmetros de campanha e domínio de origem, para
-- medir a conversão dos anúncios e saber qual campanha traz barbearia. Nada de dado pessoal.

-- AlterTable
ALTER TABLE "conta" ADD COLUMN     "origem" JSONB;


-- A ficha da conta na administração mostra a origem (junto com a situação).
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
           'interna', interna,
           'origem', origem)
    INTO r FROM conta WHERE id = p_conta;
  RETURN r;
END
$$;

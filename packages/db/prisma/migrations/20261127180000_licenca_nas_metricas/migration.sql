-- A licença e o segmento nas métricas da administração (ADR 0015): a receita mensal (MRR) usa o
-- preço da licença de cada conta, a lista de contas mostra a licença e o e-mail "próximo passo"
-- fala no vocabulário do negócio. Muda as colunas de retorno: a função é recriada (com a mesma
-- permissão). Reversível: recriar a versão anterior (sem licenca e segmento no fim).
DROP FUNCTION plataforma_contas();
CREATE FUNCTION public.plataforma_contas()
 RETURNS TABLE(id uuid, nome text, plano plano, ciclo ciclo_cobranca, status status_conta, criado_em timestamp with time zone, teste_ate timestamp with time zone, configurada_em timestamp with time zone, cobranca_automatica boolean, cancelada_em timestamp with time zone, motivo_cancelamento text, vendedor_id uuid, precos_desde date, cupom text, desconto_bp integer, dono_ativou boolean, unidades integer, profissionais integer, whatsapp_conectado boolean, fechadas_7_dias integer, ultima_fechada_em timestamp with time zone, ultimo_acesso_em timestamp with time zone, interna boolean, cortesia_ate date, cobrar_a_partir_de date, origem jsonb, ativacao integer, licenca licenca, segmento segmento)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      c.cobrar_a_partir_de,
      c.origem,
      -- Ativação (admin U2): quantos dos 8 primeiros passos do tutorial a barbearia já fez.
      ((EXISTS (SELECT 1 FROM preco_servico x WHERE x.conta_id = c.id))::int
       + (EXISTS (SELECT 1 FROM profissional x WHERE x.conta_id = c.id AND x.ativo))::int
       + (EXISTS (SELECT 1 FROM papel_usuario x WHERE x.conta_id = c.id
                   AND x.papel IN ('gestor', 'recepcao', 'profissional')))::int
       + (EXISTS (SELECT 1 FROM bot_conexao x WHERE x.conta_id = c.id AND x.status = 'conectado'))::int
       + (EXISTS (SELECT 1 FROM agendamento x WHERE x.conta_id = c.id))::int
       + (EXISTS (SELECT 1 FROM comanda x WHERE x.conta_id = c.id AND x.status = 'fechada'))::int
       + (EXISTS (SELECT 1 FROM meta x WHERE x.conta_id = c.id))::int
       + (EXISTS (SELECT 1 FROM inscricao_push x WHERE x.conta_id = c.id))::int),
      c.licenca,
      c.segmento
    FROM conta c
    ORDER BY c.criado_em DESC
  $function$;


REVOKE ALL ON FUNCTION plataforma_contas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_contas() TO pente_fino_plataforma;

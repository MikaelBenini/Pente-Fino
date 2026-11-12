-- Funil de ativação (admin F1): por conta, quais etapas a barbearia já fez, do cadastro ao
-- pagamento. A administração soma as contas em cada etapa e mostra a etapa atual de cada uma.
-- Lê só as tabelas que a plataforma_contas() já lê (mesma política dentro de SECURITY DEFINER).
CREATE FUNCTION plataforma_funil()
  RETURNS TABLE (
    id uuid,
    criado_em timestamptz,
    interna boolean,
    servicos boolean,
    barbeiros boolean,
    agendamento boolean,
    comanda boolean,
    whatsapp boolean,
    pagamento boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT
      c.id,
      c.criado_em,
      c.interna,
      EXISTS (SELECT 1 FROM preco_servico x WHERE x.conta_id = c.id),
      EXISTS (SELECT 1 FROM profissional x WHERE x.conta_id = c.id AND x.ativo),
      EXISTS (SELECT 1 FROM agendamento x WHERE x.conta_id = c.id),
      EXISTS (SELECT 1 FROM comanda x WHERE x.conta_id = c.id AND x.status = 'fechada'),
      EXISTS (SELECT 1 FROM bot_conexao x WHERE x.conta_id = c.id AND x.status = 'conectado'),
      EXISTS (SELECT 1 FROM fatura_assinatura x WHERE x.conta_id = c.id AND x.status = 'paga')
    FROM conta c
    ORDER BY c.criado_em DESC
  $$;
REVOKE ALL ON FUNCTION plataforma_funil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_funil() TO pente_fino_plataforma;

-- Administração mais prática (admin U2, U3 e U5): notas internas por conta, e a lista de contas
-- com a origem do cadastro e a ativação (quantos dos 8 primeiros passos a barbearia fez).

-- CreateTable
CREATE TABLE "nota_interna_conta" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_afetada_id" UUID NOT NULL,
    "autor_id" UUID,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_interna_conta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nota_interna_conta_conta_afetada_id_criado_em_idx" ON "nota_interna_conta"("conta_afetada_id", "criado_em");

-- AddForeignKey
ALTER TABLE "nota_interna_conta" ADD CONSTRAINT "nota_interna_conta_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario_plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Só a administração lê e escreve as notas; a aplicação das barbearias não enxerga.
REVOKE ALL ON nota_interna_conta FROM pente_fino_aplicacao;
GRANT SELECT, INSERT ON nota_interna_conta TO pente_fino_plataforma;

-- A ativação conta em tabelas que a administração ainda não lia. A política vale só para o dono
-- das tabelas, ou seja, só dentro das funções SECURITY DEFINER (o mesmo da migração plataforma).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['preco_servico', 'papel_usuario', 'agendamento', 'meta', 'inscricao_push'] LOOP
    EXECUTE format(
      'CREATE POLICY plataforma_leitura ON %I FOR SELECT USING (current_user = %L)',
      t, current_user
    );
  END LOOP;
END
$$;

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
    cobrar_a_partir_de date,
    origem jsonb,
    ativacao integer
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
      c.cobrar_a_partir_de,
      c.origem,
      -- Ativação (admin U2): quantos dos 8 primeiros passos do tutorial a barbearia já fez.
      ((EXISTS (SELECT 1 FROM preco_servico x WHERE x.conta_id = c.id))::int
       + (EXISTS (SELECT 1 FROM profissional x WHERE x.conta_id = c.id AND x.ativo))::int
       + (EXISTS (SELECT 1 FROM papel_usuario x WHERE x.conta_id = c.id
                   AND x.papel IN ('gestor', 'recepcao', 'barbeiro')))::int
       + (EXISTS (SELECT 1 FROM bot_conexao x WHERE x.conta_id = c.id AND x.status = 'conectado'))::int
       + (EXISTS (SELECT 1 FROM agendamento x WHERE x.conta_id = c.id))::int
       + (EXISTS (SELECT 1 FROM comanda x WHERE x.conta_id = c.id AND x.status = 'fechada'))::int
       + (EXISTS (SELECT 1 FROM meta x WHERE x.conta_id = c.id))::int
       + (EXISTS (SELECT 1 FROM inscricao_push x WHERE x.conta_id = c.id))::int)
    FROM conta c
    ORDER BY c.criado_em DESC
  $$;
REVOKE ALL ON FUNCTION plataforma_contas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_contas() TO pente_fino_plataforma;

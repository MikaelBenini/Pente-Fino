-- Regras que o schema do Prisma não expressa. Escrita à mão.

-- ─── Valores válidos ──────────────────────────────────────────────────────

ALTER TABLE unidade
  ADD CONSTRAINT unidade_dias_trabalho_validos CHECK (dias_trabalho <@ ARRAY[0, 1, 2, 3, 4, 5, 6]),
  ADD CONSTRAINT unidade_capacidade_positiva CHECK (capacidade > 0);

ALTER TABLE usuario
  ADD CONSTRAINT usuario_email_minusculo CHECK (email = lower(email));

ALTER TABLE profissional
  ADD CONSTRAINT profissional_saida_depois_da_entrada CHECK (data_saida IS NULL OR data_saida >= data_entrada);

ALTER TABLE horario_profissional
  ADD CONSTRAINT horario_dia_semana_valido CHECK (dia_semana BETWEEN 0 AND 6),
  ADD CONSTRAINT horario_intervalo_valido CHECK (inicio_min >= 0 AND fim_min <= 1440 AND inicio_min < fim_min);

ALTER TABLE bloqueio_agenda
  ADD CONSTRAINT bloqueio_intervalo_valido CHECK (fim > inicio);

ALTER TABLE regra_comissao
  ADD CONSTRAINT regra_percentual_ou_fixo CHECK (num_nonnulls(percentual_bp, valor_fixo) = 1),
  ADD CONSTRAINT regra_percentual_valido CHECK (percentual_bp IS NULL OR percentual_bp BETWEEN 0 AND 10000),
  ADD CONSTRAINT regra_valor_fixo_valido CHECK (valor_fixo IS NULL OR valor_fixo >= 0);

ALTER TABLE servico
  ADD CONSTRAINT servico_duracao_positiva CHECK (duracao_min > 0),
  ADD CONSTRAINT servico_custo_valido CHECK (custo_produto >= 0),
  ADD CONSTRAINT servico_peso_valido CHECK (peso_atendimento >= 0);

ALTER TABLE preco_servico
  ADD CONSTRAINT preco_valor_valido CHECK (valor >= 0);

ALTER TABLE produto
  ADD CONSTRAINT produto_valores_validos CHECK (preco_venda >= 0 AND custo >= 0);

ALTER TABLE cliente
  ADD CONSTRAINT cliente_telefone_digitos CHECK (telefone IS NULL OR telefone ~ '^[0-9]{10,15}$');

ALTER TABLE agendamento
  ADD CONSTRAINT agendamento_intervalo_valido CHECK (fim > inicio);

ALTER TABLE comanda
  ADD CONSTRAINT comanda_totais_validos CHECK (
    total_bruto >= 0 AND desconto >= 0 AND total_liquido = total_bruto - desconto AND total_liquido >= 0
  );

ALTER TABLE item_comanda
  ADD CONSTRAINT item_tipo_consistente CHECK (
    (tipo = 'servico' AND servico_id IS NOT NULL AND produto_id IS NULL)
    OR (tipo = 'produto' AND produto_id IS NOT NULL AND servico_id IS NULL)
    OR (tipo = 'nao_operacional' AND servico_id IS NULL AND produto_id IS NULL AND descricao IS NOT NULL)
  ),
  ADD CONSTRAINT item_valores_validos CHECK (
    quantidade > 0 AND preco_unitario >= 0 AND custo_unitario >= 0 AND peso_atendimento >= 0
    AND desconto BETWEEN 0 AND quantidade * preco_unitario AND comissao_valor >= 0
  ),
  ADD CONSTRAINT item_comissao_percentual_ou_fixo CHECK (
    num_nonnulls(comissao_percentual_bp, comissao_valor_fixo) <= 1
    AND (comissao_percentual_bp IS NULL OR comissao_percentual_bp BETWEEN 0 AND 10000)
    AND (comissao_valor_fixo IS NULL OR comissao_valor_fixo >= 0)
  );

ALTER TABLE pagamento
  ADD CONSTRAINT pagamento_valor_positivo CHECK (valor > 0);

ALTER TABLE despesa
  ADD CONSTRAINT despesa_valor_positivo CHECK (valor > 0),
  ADD CONSTRAINT despesa_competencia_primeiro_dia CHECK (extract(day FROM competencia) = 1);

ALTER TABLE pagamento_comissao
  ADD CONSTRAINT pagamento_comissao_valido CHECK (valor > 0 AND periodo_fim >= periodo_inicio);

ALTER TABLE meta
  ADD CONSTRAINT meta_mes_primeiro_dia CHECK (extract(day FROM mes) = 1),
  ADD CONSTRAINT meta_objetivo_positivo CHECK (objetivo > 0),
  ADD CONSTRAINT meta_servico_conforme_tipo CHECK ((tipo = 'servico') = (servico_id IS NOT NULL));

-- ─── Unicidade com NULL contando como valor ───────────────────────────────

-- Unidade/serviço vazio vira um UUID zero só para a comparação: não pode haver dois
-- "papel X em todas as unidades", nem duas metas de faturamento no mesmo mês.
-- Índice de expressão (e não NULLS NOT DISTINCT) porque o Prisma ignora esse tipo
-- e não tenta apagá-lo nas próximas migrações.
CREATE UNIQUE INDEX papel_usuario_unico ON papel_usuario (
  usuario_id, papel, coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE UNIQUE INDEX meta_unica ON meta (
  unidade_id, mes, tipo, coalesce(servico_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE UNIQUE INDEX modelo_mensagem_unico ON modelo_mensagem (
  conta_id, coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo
);

-- ─── Agenda sem sobreposição ──────────────────────────────────────────────

-- Dois agendamentos ativos do mesmo profissional não podem se cruzar.
-- Intervalo [inicio, fim): terminar às 10h e começar outro às 10h é permitido.
ALTER TABLE agendamento
  ADD CONSTRAINT agendamento_sem_sobreposicao EXCLUDE USING gist (
    profissional_id WITH =,
    tstzrange(inicio, fim, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelado', 'falta'));

-- ─── Auditoria imutável ───────────────────────────────────────────────────

CREATE FUNCTION auditoria_imutavel() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'auditoria é imutável: % não é permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TRIGGER auditoria_imutavel
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();

-- Excluir a conta inteira (cascata) é a única forma de apagar auditoria.
CREATE TRIGGER auditoria_sem_truncate
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_imutavel();

-- ─── Vigência de preço e comissão ─────────────────────────────────────────

-- SECURITY INVOKER (padrão): rodam com o RLS de quem chama.

-- Preço vigente de um serviço numa unidade e data (maior vigência até a data).
CREATE FUNCTION preco_servico_vigente(p_servico_id uuid, p_unidade_id uuid, p_data date)
  RETURNS integer
  LANGUAGE sql STABLE
  AS $$
    SELECT valor
      FROM preco_servico
     WHERE servico_id = p_servico_id
       AND unidade_id = p_unidade_id
       AND vigencia_inicio <= p_data
     ORDER BY vigencia_inicio DESC
     LIMIT 1
  $$;

-- Regra de comissão vigente de um profissional para um tipo de item numa data.
CREATE FUNCTION regra_comissao_vigente(p_profissional_id uuid, p_tipo_item tipo_item_comissao, p_data date)
  RETURNS SETOF regra_comissao
  LANGUAGE sql STABLE
  ROWS 1
  AS $$
    SELECT *
      FROM regra_comissao
     WHERE profissional_id = p_profissional_id
       AND tipo_item = p_tipo_item
       AND vigencia_inicio <= p_data
     ORDER BY vigencia_inicio DESC
     LIMIT 1
  $$;

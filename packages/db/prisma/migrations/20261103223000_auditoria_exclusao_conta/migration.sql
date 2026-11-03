-- Auditoria continua imutável, mas some junto com a conta quando a conta inteira é
-- excluída (pedido de exclusão de dados, LGPD). A exclusão em cascata roda dentro do
-- gatilho de chave estrangeira (pg_trigger_depth() > 1); um DELETE direto não.
CREATE OR REPLACE FUNCTION auditoria_imutavel() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'auditoria é imutável: % não é permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

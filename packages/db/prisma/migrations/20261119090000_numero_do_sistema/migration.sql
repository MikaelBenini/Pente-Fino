-- O bot não responde outro número conectado ao sistema (pedido do dono em 18/11/2026: duas
-- unidades conversando, os dois bots se respondiam). Por cima do isolamento por conta, mas só
-- "sim ou não": não diz de qual barbearia é o número.
CREATE FUNCTION numero_conectado_ao_sistema(p_variantes text[])
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (SELECT 1 FROM bot_conexao WHERE numero = ANY (p_variantes))
  $$;
REVOKE ALL ON FUNCTION numero_conectado_ao_sistema(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION numero_conectado_ao_sistema(text[]) TO pente_fino_aplicacao;

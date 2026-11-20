-- ─── 4. Administração troca o WhatsApp do dono da conta (pedido do dono em 20/11/2026) ──────
-- O telefone do dono só entrava na criação da conta. Agora a ficha da conta, na administração,
-- troca (com motivo e auditoria). Achado pelo e-mail, que é único, e só se ele for dono da conta.
CREATE FUNCTION plataforma_mudar_whatsapp_dono(p_conta uuid, p_email text, p_telefone text)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  v_usuario uuid;
  v_antes text;
BEGIN
  PERFORM set_config('app.conta_id', p_conta::text, true);
  SELECT u.id, u.telefone INTO v_usuario, v_antes
    FROM usuario u
   WHERE u.conta_id = p_conta
     AND lower(u.email) = lower(p_email)
     AND EXISTS (SELECT 1 FROM papel_usuario p
                  WHERE p.conta_id = p_conta AND p.usuario_id = u.id AND p.papel = 'dono');
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'dono_inexistente'; END IF;
  UPDATE usuario SET telefone = p_telefone, atualizado_em = now() WHERE id = v_usuario;
  RETURN v_antes;
END
$$;
REVOKE ALL ON FUNCTION plataforma_mudar_whatsapp_dono(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma_mudar_whatsapp_dono(uuid, text, text) TO pente_fino_plataforma;

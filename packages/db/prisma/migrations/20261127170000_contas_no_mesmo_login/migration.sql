-- Duas contas, um login (ADR 0015, aprovado pelo dono em 27/11/2026): quem tem dois negócios
-- (uma barbearia e uma clínica, por exemplo) entra com o mesmo e-mail e a mesma senha e troca de
-- negócio pelo menu. Cada negócio continua com o seu usuário e isolado pelo RLS; o e-mail passa a
-- ser único dentro de cada conta, não no sistema todo.
-- Reversível (só se nenhum e-mail se repetir): DROP INDEX usuario_conta_id_email_key,
-- usuario_email_idx; CREATE UNIQUE INDEX usuario_email_key ON usuario (email);
-- DROP POLICY login_por_email ON conta.
DROP INDEX "usuario_email_key";
CREATE UNIQUE INDEX "usuario_conta_id_email_key" ON "usuario" ("conta_id", "email");
CREATE INDEX "usuario_email_idx" ON "usuario" ("email");

-- No login, a API enxerga só os usuários do e-mail digitado (login_por_email em usuario, de
-- 20261103230000); aqui, também as contas desses usuários (nome e licença, para o menu de trocar
-- de negócio). Só leitura, e só as contas do próprio e-mail.
CREATE POLICY login_por_email ON conta
  FOR SELECT
  USING (
    id IN (
      SELECT u.conta_id FROM usuario u
       WHERE u.email = nullif(current_setting('app.login_email', true), '')
    )
  );

-- AlterEnum
ALTER TYPE "tipo_modelo_mensagem" ADD VALUE 'aviso_clube';


-- Rotina diária: além de retorno e aniversário, o aviso de vencimento do clube (ligado por
-- padrão; só "avisoClube": false desliga).
DROP POLICY conta_rotina_automacoes ON conta;
CREATE POLICY conta_rotina_automacoes ON conta
  FOR SELECT
  USING (
    current_setting('app.rotina', true) = 'automacoes'
    AND (
      automacoes->>'retorno' = 'true'
      OR automacoes->>'aniversario' = 'true'
      OR automacoes->>'avisoClube' IS DISTINCT FROM 'false'
    )
  );

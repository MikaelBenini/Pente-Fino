-- {barbearia} (nome da conta) no lugar de {unidade} nas mensagens padrão do bot.
-- Só troca o texto que o dono não editou: quem escreveu o próprio texto fica como está.
-- A tabela tem RLS forçado (nem o dono enxerga sem app.conta_id); o FORCE sai só durante
-- esta atualização, que vale para todas as contas, e volta na mesma transação.
ALTER TABLE "modelo_mensagem" NO FORCE ROW LEVEL SECURITY;

UPDATE "modelo_mensagem"
SET "texto" = 'Olá, {cliente}! Aqui é a {barbearia}.'
WHERE "tipo" = 'boas_vindas' AND "texto" = 'Olá, {cliente}! Aqui é a {unidade}.';

UPDATE "modelo_mensagem"
SET "texto" = 'Combinado! Você volta a receber os lembretes da {barbearia}.'
WHERE "tipo" = 'volta_avisos'
  AND "texto" = 'Combinado! Você volta a receber os lembretes da {unidade}.';

ALTER TABLE "modelo_mensagem" FORCE ROW LEVEL SECURITY;

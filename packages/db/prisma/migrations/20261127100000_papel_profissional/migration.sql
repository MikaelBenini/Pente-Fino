-- Fase 1a do plano multissegmento (27/11/2026): o papel de quem atende passa de "barbeiro" para
-- "profissional", neutro para todos os segmentos (barbearia, salão, estética, academia...). O nome
-- que a tela mostra vem do vocabulário do segmento. Renomear o valor mantém todas as linhas de
-- papel_usuario (nenhum dado muda de lugar).
--
-- Para desfazer: ALTER TYPE "papel" RENAME VALUE 'profissional' TO 'barbeiro'; e o mesmo laço
-- abaixo trocando os textos.
ALTER TYPE "papel" RENAME VALUE 'barbeiro' TO 'profissional';

-- Funções que comparam com o nome antigo (hoje, plataforma_contas): recriadas com o novo. O
-- CREATE OR REPLACE mantém dono e permissões.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosrc LIKE '%''barbeiro''%'
  LOOP
    EXECUTE replace(pg_get_functiondef(f.oid), '''barbeiro''', '''profissional''');
  END LOOP;
END
$$;

-- Testes de 19/11/2026 na Unidade principal.

-- ─── 1. Histórico do estado de cada conversa (item 3) ─────────────────────────
-- Cada mudança entre "bot respondendo", "aguardando atendente" e "em atendimento humano" fica
-- gravada com o horário, o estado anterior, o novo e a origem (quem ou o que mudou). Quem grava é
-- o gatilho, para nenhuma mudança escapar (painel, celular, bot, rotinas); o código só informa a
-- origem com set_config('app.origem_conversa', ...) antes de gravar a sessão.
CREATE TABLE "bot_sessao_evento" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "autor_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_sessao_evento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bot_sessao_evento_sessao_id_criado_em_idx" ON "bot_sessao_evento"("sessao_id", "criado_em");
CREATE INDEX "bot_sessao_evento_conta_id_idx" ON "bot_sessao_evento"("conta_id");

ALTER TABLE "bot_sessao_evento" ADD CONSTRAINT "bot_sessao_evento_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_sessao_evento" ADD CONSTRAINT "bot_sessao_evento_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_sessao_evento" ADD CONSTRAINT "bot_sessao_evento_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "bot_sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bot_sessao_evento" ADD CONSTRAINT "bot_sessao_evento_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

SELECT habilitar_isolamento_conta('bot_sessao_evento');

CREATE FUNCTION situacao_da_conversa(p_atendente_desde timestamptz, p_sessao jsonb)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
    SELECT CASE
      WHEN p_atendente_desde IS NOT NULL THEN 'aguardando'
      WHEN coalesce(p_sessao->>'comAtendente', 'false') = 'true' THEN 'atendimento'
      ELSE 'bot'
    END
  $$;

CREATE FUNCTION registrar_estado_da_conversa() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_de text;
  v_para text := situacao_da_conversa(NEW.atendente_desde, NEW.sessao::jsonb);
  v_autor text := nullif(current_setting('app.autor_conversa', true), '');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_de := situacao_da_conversa(OLD.atendente_desde, OLD.sessao::jsonb);
    IF v_de = v_para THEN RETURN NEW; END IF;
  ELSIF v_para = 'bot' THEN
    -- Conversa nova com o bot: não é mudança.
    RETURN NEW;
  END IF;
  INSERT INTO bot_sessao_evento (conta_id, unidade_id, sessao_id, de, para, origem, autor_id)
  VALUES (
    NEW.conta_id,
    NEW.unidade_id,
    NEW.id,
    v_de,
    v_para,
    coalesce(nullif(current_setting('app.origem_conversa', true), ''), 'sistema'),
    CASE WHEN v_autor ~ '^[0-9a-f-]{36}$' THEN v_autor::uuid END
  );
  RETURN NEW;
END
$$;

CREATE TRIGGER bot_sessao_estado
  AFTER INSERT OR UPDATE OF atendente_desde, sessao ON bot_sessao
  FOR EACH ROW EXECUTE FUNCTION registrar_estado_da_conversa();

-- ─── 2. Endereço completo da unidade para o mapa (item 4) ─────────────────────
ALTER TABLE "unidade" ADD COLUMN "cidade" TEXT,
ADD COLUMN "uf" TEXT,
ADD COLUMN "link_mapa" TEXT;

ALTER TABLE "unidade" ADD CONSTRAINT "unidade_uf_valida" CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

-- ─── 3. Um telefone, um cliente (com ou sem o nono dígito) ─────────────────────
-- O WhatsApp às vezes entrega o celular sem o 9 ("554499764653"): virava outro cadastro. Agora o
-- banco guarda sempre a forma com o 9 (a mesma de variantesTelefone, no shared) e a restrição
-- única (conta, telefone) impede o segundo cadastro.
CREATE FUNCTION telefone_canonico(p text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
    SELECT CASE
      WHEN p ~ '^55[1-9][0-9][6-9][0-9]{7}$' THEN substr(p, 1, 4) || '9' || substr(p, 5)
      ELSE p
    END
  $$;

CREATE FUNCTION cliente_telefone_canonico() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.telefone := telefone_canonico(NEW.telefone);
  RETURN NEW;
END
$$;

CREATE TRIGGER cliente_telefone_canonico
  BEFORE INSERT OR UPDATE OF telefone ON cliente
  FOR EACH ROW EXECUTE FUNCTION cliente_telefone_canonico();

-- Os cadastros de hoje: passa para a forma com o 9 quando ela ainda não existe na conta. Os pares
-- que já existem (um com e outro sem o 9) ficam como estão, para a recepção juntar.
ALTER TABLE "cliente" NO FORCE ROW LEVEL SECURITY;

UPDATE cliente c
   SET telefone = telefone_canonico(c.telefone)
 WHERE c.telefone IS NOT NULL
   AND telefone_canonico(c.telefone) <> c.telefone
   AND NOT EXISTS (
     SELECT 1 FROM cliente d
      WHERE d.conta_id = c.conta_id AND d.telefone = telefone_canonico(c.telefone)
   );

ALTER TABLE "cliente" FORCE ROW LEVEL SECURITY;

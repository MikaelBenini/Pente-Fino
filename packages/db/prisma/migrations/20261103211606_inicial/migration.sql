-- CreateEnum
CREATE TYPE "plano" AS ENUM ('basico', 'pro', 'premium');

-- CreateEnum
CREATE TYPE "status_conta" AS ENUM ('teste', 'ativa', 'suspensa', 'cancelada');

-- CreateEnum
CREATE TYPE "papel" AS ENUM ('dono', 'gestor', 'recepcao', 'barbeiro');

-- CreateEnum
CREATE TYPE "tipo_item_comissao" AS ENUM ('servico', 'produto');

-- CreateEnum
CREATE TYPE "tipo_item_comanda" AS ENUM ('servico', 'produto', 'nao_operacional');

-- CreateEnum
CREATE TYPE "status_agendamento" AS ENUM ('agendado', 'confirmado', 'atendido', 'cancelado', 'falta');

-- CreateEnum
CREATE TYPE "origem_agendamento" AS ENUM ('balcao', 'bot', 'app', 'link');

-- CreateEnum
CREATE TYPE "status_comanda" AS ENUM ('prevista', 'em_atendimento', 'confirmada', 'pendente', 'fechada', 'cancelada', 'reaberta');

-- CreateEnum
CREATE TYPE "forma_pagamento" AS ENUM ('dinheiro', 'pix', 'debito', 'credito', 'clube');

-- CreateEnum
CREATE TYPE "grupo_despesa" AS ENUM ('fixa', 'variavel', 'manutencao', 'investimento', 'retirada_dono', 'cartao_resgate');

-- CreateEnum
CREATE TYPE "tipo_meta" AS ENUM ('faturamento', 'servico');

-- CreateEnum
CREATE TYPE "status_bot_conexao" AS ENUM ('desconectado', 'aguardando_qr', 'conectado');

-- CreateEnum
CREATE TYPE "tipo_no_bot" AS ENUM ('mensagem', 'menu', 'palavra_chave', 'acao');

-- CreateEnum
CREATE TYPE "tipo_modelo_mensagem" AS ENUM ('lembrete', 'confirmacao', 'retorno', 'aniversario');

-- CreateTable
CREATE TABLE "conta" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "nome" TEXT NOT NULL,
    "logo_url" TEXT,
    "plano" "plano" NOT NULL DEFAULT 'basico',
    "status" "status_conta" NOT NULL DEFAULT 'teste',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "telefone" TEXT,
    "dias_trabalho" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "capacidade" INTEGER NOT NULL DEFAULT 1,
    "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_unidade" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "trabalha" BOOLEAN NOT NULL,
    "motivo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "calendario_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senha_hash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papel_usuario" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID NOT NULL,
    "papel" "papel" NOT NULL,
    "unidade_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "papel_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "data_entrada" DATE NOT NULL,
    "data_saida" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horario_profissional" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "profissional_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "inicio_min" INTEGER NOT NULL,
    "fim_min" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "horario_profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueio_agenda" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "profissional_id" UUID NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bloqueio_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regra_comissao" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "profissional_id" UUID NOT NULL,
    "tipo_item" "tipo_item_comissao" NOT NULL,
    "percentual_bp" INTEGER,
    "valor_fixo" INTEGER,
    "vigencia_inicio" DATE NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "regra_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servico" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "duracao_min" INTEGER NOT NULL,
    "custo_produto" INTEGER NOT NULL DEFAULT 0,
    "eh_extra" BOOLEAN NOT NULL DEFAULT false,
    "peso_atendimento" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preco_servico" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "servico_id" UUID NOT NULL,
    "unidade_id" UUID NOT NULL,
    "valor" INTEGER NOT NULL,
    "vigencia_inicio" DATE NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "preco_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "foto_url" TEXT,
    "preco_venda" INTEGER NOT NULL,
    "custo" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "aniversario" DATE,
    "unidade_origem_id" UUID,
    "origem_lead" TEXT,
    "etapa_lead" TEXT,
    "consentimento_msg" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota_cliente" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "cliente_id" UUID NOT NULL,
    "profissional_id" UUID,
    "autor_id" UUID,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nota_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "cliente_id" UUID,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "status" "status_agendamento" NOT NULL DEFAULT 'agendado',
    "origem" "origem_agendamento" NOT NULL DEFAULT 'balcao',
    "observacao" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comanda" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "cliente_id" UUID,
    "profissional_id" UUID NOT NULL,
    "agendamento_id" UUID,
    "status" "status_comanda" NOT NULL DEFAULT 'prevista',
    "total_bruto" INTEGER NOT NULL DEFAULT 0,
    "desconto" INTEGER NOT NULL DEFAULT 0,
    "total_liquido" INTEGER NOT NULL DEFAULT 0,
    "iniciada_em" TIMESTAMPTZ(3),
    "confirmada_em" TIMESTAMPTZ(3),
    "fechada_em" TIMESTAMPTZ(3),
    "fechada_por_id" UUID,
    "cancelada_em" TIMESTAMPTZ(3),
    "motivo_cancelamento" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_comanda" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "comanda_id" UUID NOT NULL,
    "tipo" "tipo_item_comanda" NOT NULL,
    "servico_id" UUID,
    "produto_id" UUID,
    "descricao" TEXT,
    "profissional_id" UUID,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "preco_unitario" INTEGER NOT NULL,
    "desconto" INTEGER NOT NULL DEFAULT 0,
    "custo_unitario" INTEGER NOT NULL DEFAULT 0,
    "coberto_clube" BOOLEAN NOT NULL DEFAULT false,
    "eh_extra" BOOLEAN NOT NULL DEFAULT false,
    "peso_atendimento" INTEGER NOT NULL DEFAULT 0,
    "comissao_percentual_bp" INTEGER,
    "comissao_valor_fixo" INTEGER,
    "comissao_valor" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_comanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "comanda_id" UUID NOT NULL,
    "forma" "forma_pagamento" NOT NULL,
    "valor" INTEGER NOT NULL,
    "recebido_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixa_dia" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "valor_abertura" INTEGER NOT NULL DEFAULT 0,
    "aberto_por_id" UUID,
    "aberto_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_por_id" UUID,
    "fechado_em" TIMESTAMPTZ(3),
    "total_sistema" INTEGER,
    "total_informado" INTEGER,
    "divergencia" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "caixa_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_despesa" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "nome" TEXT NOT NULL,
    "grupo" "grupo_despesa" NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categoria_despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "despesa" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID,
    "categoria_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "competencia" DATE NOT NULL,
    "vencimento" DATE,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pago_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento_comissao" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "profissional_id" UUID NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "valor" INTEGER NOT NULL,
    "pago_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pago_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pagamento_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "mes" DATE NOT NULL,
    "tipo" "tipo_meta" NOT NULL,
    "servico_id" UUID,
    "objetivo" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "usuario_id" UUID,
    "entidade" TEXT NOT NULL,
    "entidade_id" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "motivo" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_conexao" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'evolution',
    "instancia" TEXT NOT NULL,
    "numero" TEXT,
    "status" "status_bot_conexao" NOT NULL DEFAULT 'desconectado',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bot_conexao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_no" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID,
    "pai_id" UUID,
    "tipo" "tipo_no_bot" NOT NULL,
    "texto" TEXT NOT NULL,
    "opcao_numero" INTEGER,
    "palavras_chave" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "acao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bot_no_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo_mensagem" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID,
    "tipo" "tipo_modelo_mensagem" NOT NULL,
    "texto" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modelo_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unidade_conta_id_idx" ON "unidade"("conta_id");

-- CreateIndex
CREATE INDEX "calendario_unidade_conta_id_idx" ON "calendario_unidade"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendario_unidade_unidade_id_data_key" ON "calendario_unidade"("unidade_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_conta_id_idx" ON "usuario"("conta_id");

-- CreateIndex
CREATE INDEX "papel_usuario_conta_id_idx" ON "papel_usuario"("conta_id");

-- CreateIndex
CREATE INDEX "papel_usuario_usuario_id_idx" ON "papel_usuario"("usuario_id");

-- CreateIndex
CREATE INDEX "profissional_conta_id_idx" ON "profissional"("conta_id");

-- CreateIndex
CREATE INDEX "profissional_unidade_id_idx" ON "profissional"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_usuario_id_unidade_id_key" ON "profissional"("usuario_id", "unidade_id");

-- CreateIndex
CREATE INDEX "horario_profissional_conta_id_idx" ON "horario_profissional"("conta_id");

-- CreateIndex
CREATE INDEX "horario_profissional_profissional_id_dia_semana_idx" ON "horario_profissional"("profissional_id", "dia_semana");

-- CreateIndex
CREATE INDEX "bloqueio_agenda_conta_id_idx" ON "bloqueio_agenda"("conta_id");

-- CreateIndex
CREATE INDEX "bloqueio_agenda_profissional_id_inicio_idx" ON "bloqueio_agenda"("profissional_id", "inicio");

-- CreateIndex
CREATE INDEX "regra_comissao_conta_id_idx" ON "regra_comissao"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "regra_comissao_profissional_id_tipo_item_vigencia_inicio_key" ON "regra_comissao"("profissional_id", "tipo_item", "vigencia_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "servico_conta_id_nome_key" ON "servico"("conta_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "preco_servico_conta_id_servico_id_unidade_id_vigencia_inici_key" ON "preco_servico"("conta_id", "servico_id", "unidade_id", "vigencia_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "produto_conta_id_nome_key" ON "produto"("conta_id", "nome");

-- CreateIndex
CREATE INDEX "cliente_conta_id_nome_idx" ON "cliente"("conta_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_conta_id_telefone_key" ON "cliente"("conta_id", "telefone");

-- CreateIndex
CREATE INDEX "nota_cliente_conta_id_idx" ON "nota_cliente"("conta_id");

-- CreateIndex
CREATE INDEX "nota_cliente_cliente_id_idx" ON "nota_cliente"("cliente_id");

-- CreateIndex
CREATE INDEX "agendamento_conta_id_idx" ON "agendamento"("conta_id");

-- CreateIndex
CREATE INDEX "agendamento_profissional_id_inicio_idx" ON "agendamento"("profissional_id", "inicio");

-- CreateIndex
CREATE INDEX "agendamento_unidade_id_inicio_idx" ON "agendamento"("unidade_id", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "comanda_agendamento_id_key" ON "comanda"("agendamento_id");

-- CreateIndex
CREATE INDEX "comanda_conta_id_idx" ON "comanda"("conta_id");

-- CreateIndex
CREATE INDEX "comanda_unidade_id_status_fechada_em_idx" ON "comanda"("unidade_id", "status", "fechada_em");

-- CreateIndex
CREATE INDEX "comanda_profissional_id_status_idx" ON "comanda"("profissional_id", "status");

-- CreateIndex
CREATE INDEX "item_comanda_conta_id_idx" ON "item_comanda"("conta_id");

-- CreateIndex
CREATE INDEX "item_comanda_comanda_id_idx" ON "item_comanda"("comanda_id");

-- CreateIndex
CREATE INDEX "item_comanda_profissional_id_criado_em_idx" ON "item_comanda"("profissional_id", "criado_em");

-- CreateIndex
CREATE INDEX "pagamento_conta_id_idx" ON "pagamento"("conta_id");

-- CreateIndex
CREATE INDEX "pagamento_comanda_id_idx" ON "pagamento"("comanda_id");

-- CreateIndex
CREATE INDEX "caixa_dia_conta_id_idx" ON "caixa_dia"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "caixa_dia_unidade_id_data_key" ON "caixa_dia"("unidade_id", "data");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_despesa_conta_id_nome_key" ON "categoria_despesa"("conta_id", "nome");

-- CreateIndex
CREATE INDEX "despesa_conta_id_competencia_idx" ON "despesa"("conta_id", "competencia");

-- CreateIndex
CREATE INDEX "despesa_unidade_id_competencia_idx" ON "despesa"("unidade_id", "competencia");

-- CreateIndex
CREATE INDEX "pagamento_comissao_conta_id_idx" ON "pagamento_comissao"("conta_id");

-- CreateIndex
CREATE INDEX "pagamento_comissao_profissional_id_periodo_inicio_idx" ON "pagamento_comissao"("profissional_id", "periodo_inicio");

-- CreateIndex
CREATE INDEX "meta_conta_id_idx" ON "meta"("conta_id");

-- CreateIndex
CREATE INDEX "meta_unidade_id_mes_idx" ON "meta"("unidade_id", "mes");

-- CreateIndex
CREATE INDEX "auditoria_conta_id_entidade_entidade_id_idx" ON "auditoria"("conta_id", "entidade", "entidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_conexao_unidade_id_key" ON "bot_conexao"("unidade_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_conexao_instancia_key" ON "bot_conexao"("instancia");

-- CreateIndex
CREATE INDEX "bot_conexao_conta_id_idx" ON "bot_conexao"("conta_id");

-- CreateIndex
CREATE INDEX "bot_no_conta_id_idx" ON "bot_no"("conta_id");

-- CreateIndex
CREATE INDEX "bot_no_pai_id_idx" ON "bot_no"("pai_id");

-- CreateIndex
CREATE INDEX "modelo_mensagem_conta_id_idx" ON "modelo_mensagem"("conta_id");

-- AddForeignKey
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_unidade" ADD CONSTRAINT "calendario_unidade_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_unidade" ADD CONSTRAINT "calendario_unidade_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_usuario" ADD CONSTRAINT "papel_usuario_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_usuario" ADD CONSTRAINT "papel_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papel_usuario" ADD CONSTRAINT "papel_usuario_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional" ADD CONSTRAINT "profissional_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_profissional" ADD CONSTRAINT "horario_profissional_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horario_profissional" ADD CONSTRAINT "horario_profissional_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueio_agenda" ADD CONSTRAINT "bloqueio_agenda_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueio_agenda" ADD CONSTRAINT "bloqueio_agenda_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_comissao" ADD CONSTRAINT "regra_comissao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regra_comissao" ADD CONSTRAINT "regra_comissao_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servico" ADD CONSTRAINT "servico_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_servico" ADD CONSTRAINT "preco_servico_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_servico" ADD CONSTRAINT "preco_servico_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preco_servico" ADD CONSTRAINT "preco_servico_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_unidade_origem_id_fkey" FOREIGN KEY ("unidade_origem_id") REFERENCES "unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_cliente" ADD CONSTRAINT "nota_cliente_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_cliente" ADD CONSTRAINT "nota_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_cliente" ADD CONSTRAINT "nota_cliente_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_cliente" ADD CONSTRAINT "nota_cliente_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comanda" ADD CONSTRAINT "comanda_fechada_por_id_fkey" FOREIGN KEY ("fechada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_recebido_por_id_fkey" FOREIGN KEY ("recebido_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_dia" ADD CONSTRAINT "caixa_dia_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_dia" ADD CONSTRAINT "caixa_dia_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_dia" ADD CONSTRAINT "caixa_dia_aberto_por_id_fkey" FOREIGN KEY ("aberto_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixa_dia" ADD CONSTRAINT "caixa_dia_fechado_por_id_fkey" FOREIGN KEY ("fechado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria_despesa" ADD CONSTRAINT "categoria_despesa_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesa" ADD CONSTRAINT "despesa_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesa" ADD CONSTRAINT "despesa_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "despesa" ADD CONSTRAINT "despesa_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria_despesa"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_comissao" ADD CONSTRAINT "pagamento_comissao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_comissao" ADD CONSTRAINT "pagamento_comissao_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissional"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_comissao" ADD CONSTRAINT "pagamento_comissao_pago_por_id_fkey" FOREIGN KEY ("pago_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_conexao" ADD CONSTRAINT "bot_conexao_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_conexao" ADD CONSTRAINT "bot_conexao_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_no" ADD CONSTRAINT "bot_no_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_no" ADD CONSTRAINT "bot_no_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_no" ADD CONSTRAINT "bot_no_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "bot_no"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelo_mensagem" ADD CONSTRAINT "modelo_mensagem_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelo_mensagem" ADD CONSTRAINT "modelo_mensagem_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

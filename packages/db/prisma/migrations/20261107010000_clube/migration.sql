-- CreateEnum
CREATE TYPE "tipo_item_clube" AS ENUM ('assinatura', 'combo', 'convenio');

-- CreateEnum
CREATE TYPE "status_adesao" AS ENUM ('ativa', 'vencida', 'cancelada');

-- AlterTable
ALTER TABLE "item_comanda" ADD COLUMN     "adesao_id" UUID;

-- CreateTable
CREATE TABLE "item_clube" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "unidade_id" UUID NOT NULL,
    "tipo" "tipo_item_clube" NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" INTEGER NOT NULL,
    "limite_uso_mes" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_clube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_clube_servico" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "item_clube_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "quantidade" INTEGER,
    "comissao_valor_fixo" INTEGER,

    CONSTRAINT "item_clube_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adesao_clube" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "conta_id" UUID NOT NULL DEFAULT conta_atual(),
    "cliente_id" UUID NOT NULL,
    "item_clube_id" UUID NOT NULL,
    "status" "status_adesao" NOT NULL DEFAULT 'ativa',
    "inicio" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "cancelada_em" TIMESTAMPTZ(3),
    "motivo_cancelamento" TEXT,
    "criado_por_id" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "adesao_clube_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_clube_conta_id_idx" ON "item_clube"("conta_id");

-- CreateIndex
CREATE INDEX "item_clube_unidade_id_idx" ON "item_clube"("unidade_id");

-- CreateIndex
CREATE INDEX "item_clube_servico_conta_id_idx" ON "item_clube_servico"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_clube_servico_item_clube_id_servico_id_key" ON "item_clube_servico"("item_clube_id", "servico_id");

-- CreateIndex
CREATE INDEX "adesao_clube_conta_id_idx" ON "adesao_clube"("conta_id");

-- CreateIndex
CREATE INDEX "adesao_clube_cliente_id_status_idx" ON "adesao_clube"("cliente_id", "status");

-- AddForeignKey
ALTER TABLE "item_comanda" ADD CONSTRAINT "item_comanda_adesao_id_fkey" FOREIGN KEY ("adesao_id") REFERENCES "adesao_clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_clube" ADD CONSTRAINT "item_clube_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_clube" ADD CONSTRAINT "item_clube_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_clube_servico" ADD CONSTRAINT "item_clube_servico_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_clube_servico" ADD CONSTRAINT "item_clube_servico_item_clube_id_fkey" FOREIGN KEY ("item_clube_id") REFERENCES "item_clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_clube_servico" ADD CONSTRAINT "item_clube_servico_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adesao_clube" ADD CONSTRAINT "adesao_clube_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adesao_clube" ADD CONSTRAINT "adesao_clube_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adesao_clube" ADD CONSTRAINT "adesao_clube_item_clube_id_fkey" FOREIGN KEY ("item_clube_id") REFERENCES "item_clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adesao_clube" ADD CONSTRAINT "adesao_clube_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "item_clube" ADD CONSTRAINT item_clube_valores CHECK (valor >= 0 AND (limite_uso_mes IS NULL OR limite_uso_mes > 0));
ALTER TABLE "item_clube_servico" ADD CONSTRAINT item_clube_servico_valores CHECK ((quantidade IS NULL OR quantidade > 0) AND (comissao_valor_fixo IS NULL OR comissao_valor_fixo >= 0));
ALTER TABLE "adesao_clube" ADD CONSTRAINT adesao_clube_periodo CHECK (vencimento > inicio);
-- Um plano ativo por cliente de cada vez (o que o plano cobre não pode ser ambíguo).
CREATE UNIQUE INDEX adesao_clube_uma_ativa ON "adesao_clube" (cliente_id) WHERE status = 'ativa';

-- Isolamento por conta (RLS), como toda tabela de negócio.
SELECT habilitar_isolamento_conta('item_clube');
SELECT habilitar_isolamento_conta('item_clube_servico');
SELECT habilitar_isolamento_conta('adesao_clube');

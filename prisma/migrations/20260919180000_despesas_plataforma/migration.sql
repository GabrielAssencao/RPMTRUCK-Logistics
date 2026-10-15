CREATE TYPE "CategoriaDespesaPlataforma" AS ENUM (
  'INFRAESTRUTURA', 'DOMINIO_EMAIL', 'SOFTWARE_IA', 'MARKETING',
  'LEGAL_CONTABIL', 'GATEWAY_OUTROS', 'OUTROS'
);

CREATE TABLE "despesas_plataforma" (
  "id" TEXT NOT NULL,
  "descricao" VARCHAR(160) NOT NULL,
  "categoria" "CategoriaDespesaPlataforma" NOT NULL,
  "valor" DECIMAL(12,2) NOT NULL,
  "data_pagamento" DATE NOT NULL,
  "observacao" VARCHAR(500),
  "criado_por_id" TEXT NOT NULL,
  "excluida_em" TIMESTAMP(3),
  "excluida_por_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "despesas_plataforma_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "despesas_plataforma_valor_positivo" CHECK ("valor" > 0)
);

CREATE INDEX "despesas_plataforma_excluida_em_data_pagamento_idx" ON "despesas_plataforma"("excluida_em", "data_pagamento");
CREATE INDEX "faturas_status_pago_em_idx" ON "faturas"("status", "pago_em");

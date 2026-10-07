CREATE TYPE "MetodoRecorrenciaPagamento" AS ENUM ('CARTAO', 'PIX_AUTOMATICO');
CREATE TYPE "StatusRecorrenciaPagamento" AS ENUM ('AGUARDANDO_ADESAO', 'ATIVA', 'CANCELADA', 'FALHA');

CREATE TABLE "recorrencias_pagamento" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "metodo" "MetodoRecorrenciaPagamento" NOT NULL,
  "status" "StatusRecorrenciaPagamento" NOT NULL DEFAULT 'AGUARDANDO_ADESAO',
  "valor" DECIMAL(12,2) NOT NULL,
  "fatura_inicial_id" TEXT NOT NULL,
  "asaas_checkout_id" TEXT,
  "asaas_subscription_id" TEXT,
  "asaas_authorization_id" TEXT,
  "conciliacao_inicial_id" TEXT,
  "adesao_url" TEXT,
  "pix_copia_e_cola" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recorrencias_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recorrencias_pagamento_empresa_id_key" ON "recorrencias_pagamento"("empresa_id");
CREATE UNIQUE INDEX "recorrencias_pagamento_fatura_inicial_id_key" ON "recorrencias_pagamento"("fatura_inicial_id");
CREATE UNIQUE INDEX "recorrencias_pagamento_asaas_checkout_id_key" ON "recorrencias_pagamento"("asaas_checkout_id");
CREATE UNIQUE INDEX "recorrencias_pagamento_asaas_subscription_id_key" ON "recorrencias_pagamento"("asaas_subscription_id");
CREATE UNIQUE INDEX "recorrencias_pagamento_asaas_authorization_id_key" ON "recorrencias_pagamento"("asaas_authorization_id");
CREATE UNIQUE INDEX "recorrencias_pagamento_conciliacao_inicial_id_key" ON "recorrencias_pagamento"("conciliacao_inicial_id");
CREATE INDEX "recorrencias_pagamento_status_metodo_idx" ON "recorrencias_pagamento"("status", "metodo");
ALTER TABLE "recorrencias_pagamento" ADD CONSTRAINT "recorrencias_pagamento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recorrencias_pagamento" ADD CONSTRAINT "recorrencias_pagamento_fatura_inicial_id_fkey" FOREIGN KEY ("fatura_inicial_id") REFERENCES "faturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

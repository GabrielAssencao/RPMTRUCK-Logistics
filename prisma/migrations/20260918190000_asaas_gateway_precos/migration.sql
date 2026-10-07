CREATE TYPE "ProvedorPagamento" AS ENUM ('MANUAL', 'ASAAS');

ALTER TABLE "empresas"
  ADD COLUMN "asaas_customer_id" TEXT;

CREATE UNIQUE INDEX "empresas_asaas_customer_id_key"
  ON "empresas"("asaas_customer_id");

ALTER TABLE "faturas"
  ADD COLUMN "provedor_pagamento" "ProvedorPagamento" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "gateway_payment_id" TEXT,
  ADD COLUMN "gateway_status" TEXT,
  ADD COLUMN "gateway_billing_type" TEXT,
  ADD COLUMN "gateway_invoice_url" TEXT,
  ADD COLUMN "gateway_net_value" DECIMAL(12,2),
  ADD COLUMN "gateway_sincronizado_em" TIMESTAMP(3),
  ADD COLUMN "gateway_erro" VARCHAR(500);

CREATE UNIQUE INDEX "faturas_gateway_payment_id_key"
  ON "faturas"("gateway_payment_id");
CREATE INDEX "faturas_provedor_pagamento_gateway_status_idx"
  ON "faturas"("provedor_pagamento", "gateway_status");

CREATE TABLE "eventos_webhook_pagamento" (
  "id" TEXT NOT NULL,
  "provedor" "ProvedorPagamento" NOT NULL,
  "tipo" TEXT NOT NULL,
  "pagamento_externo_id" TEXT,
  "payload_hash" VARCHAR(64) NOT NULL,
  "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processado_em" TIMESTAMP(3),
  "erro" VARCHAR(500),
  CONSTRAINT "eventos_webhook_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eventos_webhook_pagamento_provedor_pagamento_externo_id_idx"
  ON "eventos_webhook_pagamento"("provedor", "pagamento_externo_id");
CREATE INDEX "eventos_webhook_pagamento_processado_em_recebido_em_idx"
  ON "eventos_webhook_pagamento"("processado_em", "recebido_em");

ALTER TABLE "eventos_webhook_pagamento" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "eventos_webhook_pagamento" FROM anon, authenticated;

COMMENT ON TABLE "eventos_webhook_pagamento" IS
  'Controle técnico idempotente de webhooks; armazena somente metadados e hash, sem o payload financeiro completo.';

UPDATE "planos_comerciais" SET
  "preco_base" = 0,
  "taxa_implantacao" = 0,
  "preco_usuario_adicional" = 0,
  "preco_veiculo_adicional" = 0,
  "versao" = "versao" + 1
WHERE "plano" = 'PREVIEW';

UPDATE "planos_comerciais" SET
  "preco_base" = 397,
  "taxa_implantacao" = 290,
  "preco_usuario_adicional" = 35,
  "preco_veiculo_adicional" = 45,
  "versao" = "versao" + 1
WHERE "plano" = 'ESSENCIAL';

UPDATE "planos_comerciais" SET
  "preco_base" = 697,
  "taxa_implantacao" = 590,
  "preco_usuario_adicional" = 30,
  "preco_veiculo_adicional" = 40,
  "versao" = "versao" + 1
WHERE "plano" = 'AVANCADO';

UPDATE "planos_comerciais" SET
  "preco_base" = 1290,
  "taxa_implantacao" = 990,
  "preco_usuario_adicional" = 25,
  "preco_veiculo_adicional" = 30,
  "versao" = "versao" + 1
WHERE "plano" = 'ENTERPRISE';

INSERT INTO "promocoes_comerciais" (
  "id", "nome", "grupo", "descricao", "escopo", "plano",
  "preco_base_inicial", "meses_preco_inicial", "preco_base_renovacao",
  "taxa_implantacao", "limite_adesoes", "adesoes_confirmadas",
  "ativa", "visivel_solicitacao", "criado_em", "atualizado_em"
) VALUES (
  gen_random_uuid()::text, 'Fundadoras - Essencial', 'FUNDADORAS',
  'Condição de lançamento para as cinco primeiras empresas fundadoras.',
  'NOVAS_EMPRESAS', 'ESSENCIAL', 297, 12, 397, 0, 5, 0, true, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("nome") DO UPDATE SET
  "grupo" = EXCLUDED."grupo",
  "descricao" = EXCLUDED."descricao",
  "escopo" = EXCLUDED."escopo",
  "plano" = EXCLUDED."plano",
  "preco_base_inicial" = EXCLUDED."preco_base_inicial",
  "meses_preco_inicial" = EXCLUDED."meses_preco_inicial",
  "preco_base_renovacao" = EXCLUDED."preco_base_renovacao",
  "taxa_implantacao" = EXCLUDED."taxa_implantacao",
  "limite_adesoes" = EXCLUDED."limite_adesoes",
  "ativa" = true,
  "visivel_solicitacao" = true,
  "atualizado_em" = CURRENT_TIMESTAMP;

INSERT INTO "promocoes_comerciais" (
  "id", "nome", "grupo", "descricao", "escopo", "plano",
  "preco_base_inicial", "meses_preco_inicial", "preco_base_renovacao",
  "taxa_implantacao", "limite_adesoes", "adesoes_confirmadas",
  "ativa", "visivel_solicitacao", "criado_em", "atualizado_em"
) VALUES (
  gen_random_uuid()::text, 'Piloto RPM Truck', 'PILOTO_2026',
  'Primeira mensalidade de R$ 250 e mensalidades seguintes de R$ 150.',
  'EMPRESAS_ATIVAS', 'ESSENCIAL', 250, 1, 150, 0, 1, 0, true, false,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("nome") DO UPDATE SET
  "grupo" = EXCLUDED."grupo",
  "descricao" = EXCLUDED."descricao",
  "escopo" = EXCLUDED."escopo",
  "plano" = EXCLUDED."plano",
  "preco_base_inicial" = EXCLUDED."preco_base_inicial",
  "meses_preco_inicial" = EXCLUDED."meses_preco_inicial",
  "preco_base_renovacao" = EXCLUDED."preco_base_renovacao",
  "taxa_implantacao" = EXCLUDED."taxa_implantacao",
  "limite_adesoes" = EXCLUDED."limite_adesoes",
  "ativa" = true,
  "visivel_solicitacao" = false,
  "atualizado_em" = CURRENT_TIMESTAMP;

UPDATE "promocoes_comerciais" SET
  "preco_base_inicial" = 497,
  "preco_base_renovacao" = 697,
  "taxa_implantacao" = 0,
  "grupo" = 'FUNDADORAS',
  "limite_adesoes" = 5,
  "ativa" = true,
  "visivel_solicitacao" = true,
  "atualizado_em" = CURRENT_TIMESTAMP
WHERE "nome" = 'Fundadoras - Avançado';

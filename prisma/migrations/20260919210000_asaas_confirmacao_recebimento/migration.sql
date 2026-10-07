ALTER TABLE "faturas" ADD COLUMN "gateway_recebido_em" TIMESTAMP(3);

-- Cobranças já recebidas antes desta migração usam a data de baixa existente.
UPDATE "faturas"
SET "gateway_recebido_em" = "pago_em"
WHERE "provedor_pagamento" = 'ASAAS'
  AND "status" = 'PAGO'
  AND "gateway_status" = 'RECEIVED'
  AND "pago_em" IS NOT NULL;

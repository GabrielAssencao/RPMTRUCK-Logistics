ALTER TABLE "empresas"
  ADD COLUMN "pagamento_inicial_vence_em" TIMESTAMP(3),
  ADD COLUMN "primeira_mensalidade_paga_em" TIMESTAMP(3);

ALTER TABLE "faturas" ADD COLUMN "vencimento" TIMESTAMP(3);
ALTER TABLE "empresas" ADD COLUMN "cobranca_iniciada_em" TIMESTAMP(3), ADD COLUMN "dia_vencimento" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "solicitacoes_acesso" ADD COLUMN "dia_vencimento" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_dia_vencimento_check" CHECK ("dia_vencimento" IN (5, 28));
ALTER TABLE "solicitacoes_acesso" ADD CONSTRAINT "solicitacoes_dia_vencimento_check" CHECK ("dia_vencimento" IN (5, 28));
CREATE INDEX "faturas_empresaId_status_vencimento_idx" ON "faturas"("empresaId", "status", "vencimento");

-- Preserva clientes e vencimentos legados: não inventa prazo retroativo.
UPDATE "empresas" AS empresa
SET "primeira_mensalidade_paga_em" = pagamentos.primeiro_pagamento
FROM (
  SELECT "empresaId", MIN(COALESCE("pago_em", "criado_em")) AS primeiro_pagamento
  FROM "faturas" WHERE "tipo" = 'MENSALIDADE' AND "status" = 'PAGO' AND "valor" > 0
  GROUP BY "empresaId"
) AS pagamentos
WHERE empresa."id" = pagamentos."empresaId";

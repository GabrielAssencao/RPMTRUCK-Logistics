ALTER TABLE "faturas"
  ADD COLUMN "lembrete_pagamento_enviado_em" TIMESTAMP(3);

CREATE INDEX "faturas_status_vencimento_lembrete_pagamento_enviado_em_idx"
  ON "faturas"("status", "vencimento", "lembrete_pagamento_enviado_em");

-- Os avisos antigos eram criados junto com a fatura, muitas semanas antes do
-- vencimento. Eles permanecem no histórico, mas deixam de ocupar o sino.
UPDATE "notificacoes"
SET "lida" = true
WHERE "lida" = false
  AND "modulo" = 'GERAL'
  AND "titulo" LIKE 'Mensalidade do plano:%'
  AND "mensagem" LIKE '%Regularize com o suporte%';

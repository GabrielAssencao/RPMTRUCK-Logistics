CREATE TYPE "AcaoFimPromocaoRecorrencia" AS ENUM ('ATUALIZAR_VALOR', 'DESATIVAR_RECORRENCIA');
CREATE TYPE "StatusTransicaoPromocaoRecorrencia" AS ENUM ('AGENDADA', 'PROCESSANDO', 'CONFIRMADA', 'FALHA');

ALTER TABLE "recorrencias_pagamento"
  ADD COLUMN "valor_renovacao" DECIMAL(12,2),
  ADD COLUMN "renovacao_em" TIMESTAMP(3),
  ADD COLUMN "acao_fim_promocao" "AcaoFimPromocaoRecorrencia",
  ADD COLUMN "transicao_promocao_status" "StatusTransicaoPromocaoRecorrencia",
  ADD COLUMN "aviso_promocao_enviado_em" TIMESTAMP(3),
  ADD COLUMN "transicao_promocao_solicitada_em" TIMESTAMP(3),
  ADD COLUMN "transicao_promocao_confirmada_em" TIMESTAMP(3),
  ADD COLUMN "transicao_promocao_erro" VARCHAR(500);

CREATE INDEX "recorrencias_pagamento_transicao_promocao_status_renovacao_em_idx"
  ON "recorrencias_pagamento"("transicao_promocao_status", "renovacao_em");

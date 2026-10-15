BEGIN;

CREATE TYPE "OrigemConversaSuporte" AS ENUM ('EMPRESA', 'SUPERADMIN');

ALTER TABLE "conversas_suporte"
  ADD COLUMN "origem" "OrigemConversaSuporte" NOT NULL DEFAULT 'EMPRESA',
  ADD COLUMN "respostas_empresa_habilitadas" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "conversas_suporte_origem_status_atualizado_em_idx"
  ON "conversas_suporte"("origem", "status", "atualizado_em");

COMMIT;

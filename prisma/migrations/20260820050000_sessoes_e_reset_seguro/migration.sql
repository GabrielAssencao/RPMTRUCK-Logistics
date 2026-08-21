-- Sessões revogáveis e recuperação de senha com token de uso único.
ALTER TYPE "StatusReset" ADD VALUE IF NOT EXISTS 'APROVADO' AFTER 'PENDENTE';

ALTER TABLE "usuarios"
ADD COLUMN "sessao_versao" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "resets_senha"
ADD COLUMN "token_hash" TEXT,
ADD COLUMN "token_expira_em" TIMESTAMP(3),
ADD COLUMN "token_usado_em" TIMESTAMP(3);

-- Remove senhas temporárias legadas armazenadas em texto legível.
UPDATE "resets_senha"
SET "chave" = NULL
WHERE "chave" IS NOT NULL;

CREATE INDEX "resets_senha_email_status_idx"
ON "resets_senha"("email", "status");

CREATE INDEX "resets_senha_token_expira_em_idx"
ON "resets_senha"("token_expira_em");

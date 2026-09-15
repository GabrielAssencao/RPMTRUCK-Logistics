ALTER TABLE "usuarios" ADD COLUMN "lembretes_retencao_dias" INTEGER;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_lembretes_retencao_check" CHECK ("lembretes_retencao_dias" IN (1, 7, 30, 90));
ALTER TABLE "lembretes_pessoais" ADD COLUMN "concluido_em" TIMESTAMP(3);
-- Preserva os conclu?dos existentes com um prazo completo a partir da migra??o.
UPDATE "lembretes_pessoais" SET "concluido_em" = CURRENT_TIMESTAMP WHERE "concluido" = true;
ALTER TABLE "lembretes_pessoais" ADD CONSTRAINT "lembretes_conclusao_check" CHECK ("concluido" = ("concluido_em" IS NOT NULL));
CREATE INDEX "lembretes_pessoais_concluido_concluido_em_idx" ON "lembretes_pessoais"("concluido", "concluido_em");

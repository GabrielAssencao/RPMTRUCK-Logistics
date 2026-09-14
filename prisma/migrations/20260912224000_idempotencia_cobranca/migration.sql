-- Novas cobranças ganham uma referência estável. Faturas legadas não são alteradas.
ALTER TABLE "faturas" ADD COLUMN "chave_cobranca" TEXT;
CREATE UNIQUE INDEX "faturas_chave_cobranca_key" ON "faturas"("chave_cobranca");

DROP INDEX IF EXISTS "faturas_gateway_payment_id_key";
CREATE INDEX "faturas_gateway_payment_id_idx" ON "faturas"("gateway_payment_id");

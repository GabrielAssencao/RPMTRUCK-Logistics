ALTER TABLE "solicitacoes_assinatura"
  DROP CONSTRAINT IF EXISTS "solicitacoes_assinatura_tipo_check";

ALTER TABLE "solicitacoes_assinatura"
  ADD CONSTRAINT "solicitacoes_assinatura_tipo_check" CHECK (
    ("tipo" = 'ALTERAR_PLANO' AND "plano_solicitado" IS NOT NULL AND "fatura_id" IS NULL) OR
    ("tipo" = 'ALTERAR_COTAS' AND "plano_solicitado" IS NULL AND "fatura_id" IS NULL) OR
    ("tipo" = 'ALTERAR_VENCIMENTO' AND "plano_solicitado" IS NULL AND "fatura_id" IS NULL) OR
    ("tipo" = 'NEGOCIAR_PAGAMENTO' AND "plano_solicitado" IS NULL AND "fatura_id" IS NOT NULL)
  );

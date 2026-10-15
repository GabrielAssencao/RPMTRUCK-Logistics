-- Estornos já conciliados deixam de ser dívida ativa. O SuperAdmin poderá
-- decidir explicitamente se a obrigação será recobrada ou encerrada.
UPDATE "faturas"
SET "status" = 'ESTORNADA'
WHERE "status" = 'PENDENTE'
  AND "gateway_status" = 'REFUNDED';

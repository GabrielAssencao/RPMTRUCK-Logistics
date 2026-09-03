INSERT INTO "custos" (
  "id",
  "data",
  "ano",
  "mesIndex",
  "semanaIndex",
  "categoria",
  "descricao",
  "valor",
  "formaPagamento",
  "status",
  "veiculoId",
  "motoristaId",
  "empresaId",
  "container_id",
  "criado_em",
  "atualizado_em"
)
SELECT
  gen_random_uuid()::text,
  container."data",
  EXTRACT(YEAR FROM container."data")::integer,
  EXTRACT(MONTH FROM container."data")::integer - 1,
  LEAST(4, FLOOR((EXTRACT(DAY FROM container."data")::integer - 1) / 7) + 1)::integer,
  'COMISSAO_TRANSPORTE'::"CategoriaCusto",
  'Comissão sobre frete — Container ' || container."codigo",
  container."comissao",
  'COMISSÃO AUTOMÁTICA',
  CASE
    WHEN container."status" = 'ENTREGUE' THEN 'PAGO'::"StatusCusto"
    ELSE 'PENDENTE'::"StatusCusto"
  END,
  container."veiculoId",
  container."motoristaId",
  container."empresaId",
  container."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "containers" AS container
WHERE container."comissao_ativa" = true
  AND container."comissao" > 0
  AND container."status" <> 'CANCELADO'
  AND NOT EXISTS (
    SELECT 1
    FROM "custos" AS custo
    WHERE custo."container_id" = container."id"
  );

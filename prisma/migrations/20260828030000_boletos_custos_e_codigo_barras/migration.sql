ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'COMBUSTIVEL';
ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'PEDAGIO';
ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'ALIMENTACAO';
ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'DIARIA_MOTORISTA';
ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'SEGURO';
ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'SALARIO';
ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'OUTROS';

ALTER TYPE "CategoriaCusto" ADD VALUE IF NOT EXISTS 'SALARIO';

ALTER TABLE "custos"
  ALTER COLUMN "veiculoId" DROP NOT NULL,
  ADD COLUMN "conta_pagar_id" TEXT;

ALTER TABLE "custos" DROP CONSTRAINT IF EXISTS "custos_veiculoId_fkey";
ALTER TABLE "custos"
  ADD CONSTRAINT "custos_veiculoId_fkey"
    FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "custos_conta_pagar_id_fkey"
    FOREIGN KEY ("conta_pagar_id") REFERENCES "contas_pagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "custos_conta_pagar_id_key" ON "custos"("conta_pagar_id");
CREATE INDEX "custos_empresaId_categoria_data_idx" ON "custos"("empresaId", "categoria", "data");

-- Preserva a integração das contas de manutenção cadastradas antes desta versão.
-- Contas canceladas não representam despesa e, por isso, não são importadas.
INSERT INTO "custos" (
  "id", "data", "ano", "mesIndex", "semanaIndex", "categoria", "descricao",
  "valor", "formaPagamento", "status", "veiculoId", "empresaId",
  "conta_pagar_id", "criado_em", "atualizado_em"
)
SELECT
  'conta-' || conta."id",
  conta."vencimento"::timestamp,
  EXTRACT(YEAR FROM conta."vencimento")::integer,
  EXTRACT(MONTH FROM conta."vencimento")::integer - 1,
  LEAST(4, FLOOR((EXTRACT(DAY FROM conta."vencimento") - 1) / 7) + 1)::integer,
  'MANUTENCAO'::"CategoriaCusto",
  'Boleto: ' || conta."descricao",
  conta."valor"::double precision,
  'BOLETO',
  CASE WHEN conta."status" = 'PAGO' THEN 'PAGO'::"StatusCusto" ELSE 'PENDENTE'::"StatusCusto" END,
  conta."veiculoId",
  conta."empresaId",
  conta."id",
  conta."criado_em",
  conta."atualizado_em"
FROM "contas_pagar" AS conta
WHERE conta."categoria" = 'MANUTENCAO'::"CategoriaContaPagar"
  AND conta."status" <> 'CANCELADO'
ON CONFLICT ("conta_pagar_id") DO NOTHING;

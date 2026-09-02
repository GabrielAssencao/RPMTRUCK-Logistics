ALTER TYPE "CategoriaContaPagar" ADD VALUE IF NOT EXISTS 'COMISSAO_TRANSPORTE';
ALTER TYPE "CategoriaCusto" ADD VALUE IF NOT EXISTS 'COMISSAO_TRANSPORTE';

ALTER TABLE "containers"
ADD COLUMN "comissao_ativa" BOOLEAN NOT NULL DEFAULT true;

UPDATE "containers"
SET "comissao_ativa" = false
WHERE "comissao" <= 0 OR "percentual_comissao" <= 0;

ALTER TABLE "custos"
ADD COLUMN "container_id" TEXT;

CREATE UNIQUE INDEX "custos_container_id_key"
ON "custos"("container_id");

ALTER TABLE "custos"
ADD CONSTRAINT "custos_container_id_fkey"
FOREIGN KEY ("container_id") REFERENCES "containers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

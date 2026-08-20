UPDATE "containers"
SET "codigo" = CONCAT(
  SUBSTRING(UPPER(REGEXP_REPLACE("codigo", '[[:space:]-]', '', 'g')) FROM 1 FOR 4),
  ' ',
  SUBSTRING(UPPER(REGEXP_REPLACE("codigo", '[[:space:]-]', '', 'g')) FROM 5 FOR 6),
  '-',
  SUBSTRING(UPPER(REGEXP_REPLACE("codigo", '[[:space:]-]', '', 'g')) FROM 11 FOR 1)
)
WHERE UPPER(REGEXP_REPLACE("codigo", '[[:space:]-]', '', 'g')) ~ '^[A-Z]{4}[0-9]{7}$';

UPDATE "movimentacoes_container_permanentes"
SET "codigo_container" = CONCAT(
  SUBSTRING(UPPER(REGEXP_REPLACE("codigo_container", '[[:space:]-]', '', 'g')) FROM 1 FOR 4),
  ' ',
  SUBSTRING(UPPER(REGEXP_REPLACE("codigo_container", '[[:space:]-]', '', 'g')) FROM 5 FOR 6),
  '-',
  SUBSTRING(UPPER(REGEXP_REPLACE("codigo_container", '[[:space:]-]', '', 'g')) FROM 11 FOR 1)
)
WHERE UPPER(REGEXP_REPLACE("codigo_container", '[[:space:]-]', '', 'g')) ~ '^[A-Z]{4}[0-9]{7}$';

ALTER TABLE "containers"
ADD COLUMN "percentual_comissao" DOUBLE PRECISION NOT NULL DEFAULT 10;

UPDATE "containers"
SET "percentual_comissao" = CASE
  WHEN "frete" > 0 THEN LEAST(100, GREATEST(0, ROUND((("comissao" / "frete") * 100)::numeric, 4)::double precision))
  ELSE 0
END;

ALTER TABLE "containers"
ADD CONSTRAINT "containers_percentual_comissao_check"
CHECK ("percentual_comissao" >= 0 AND "percentual_comissao" <= 100);

CREATE TABLE "leituras_quilometragem" (
  "id" TEXT NOT NULL,
  "quilometragem" DOUBLE PRECISION NOT NULL,
  "registrada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "origem" TEXT NOT NULL DEFAULT 'ATUALIZACAO_VEICULO',
  "veiculoId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leituras_quilometragem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leituras_quilometragem_valor_check" CHECK ("quilometragem" >= 0)
);

CREATE INDEX "leituras_quilometragem_empresaId_registrada_em_idx"
ON "leituras_quilometragem"("empresaId", "registrada_em");

CREATE INDEX "leituras_quilometragem_veiculoId_registrada_em_idx"
ON "leituras_quilometragem"("veiculoId", "registrada_em");

ALTER TABLE "leituras_quilometragem"
ADD CONSTRAINT "leituras_quilometragem_veiculoId_fkey"
FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leituras_quilometragem"
ADD CONSTRAINT "leituras_quilometragem_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "leituras_quilometragem" (
  "id", "quilometragem", "registrada_em", "origem", "veiculoId", "empresaId", "criado_em"
)
SELECT
  gen_random_uuid()::text,
  h."km_atual",
  COALESCE(h."data_conclusao", h."data_agendada"),
  'MANUTENCAO_IMPORTADA',
  h."veiculoId",
  h."empresaId",
  CURRENT_TIMESTAMP
FROM "historicos_veiculo" h
WHERE h."status" = 'CONCLUIDA';

INSERT INTO "leituras_quilometragem" (
  "id", "quilometragem", "registrada_em", "origem", "veiculoId", "empresaId", "criado_em"
)
SELECT
  gen_random_uuid()::text,
  v."quilometragem",
  CURRENT_TIMESTAMP,
  'MIGRACAO_ODOMETRO_ATUAL',
  v."id",
  v."empresaId",
  CURRENT_TIMESTAMP
FROM "veiculos" v;

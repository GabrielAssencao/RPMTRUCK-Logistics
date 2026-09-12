ALTER TABLE "tarefas"
  ADD COLUMN "inicio" TIMESTAMP(3),
  ADD COLUMN "duracao_minutos" INTEGER,
  ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "exibir_calendario" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lembrete_em" TIMESTAMP(3),
  ADD COLUMN "lembrete_enviado_em" TIMESTAMP(3);

WITH tarefas_ordenadas AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "empresaId", "status"
      ORDER BY "prazo" ASC NULLS LAST, "criado_em" ASC, "id" ASC
    ) * 1000 AS nova_ordem
  FROM "tarefas"
)
UPDATE "tarefas" AS tarefa
SET "ordem" = tarefas_ordenadas.nova_ordem
FROM tarefas_ordenadas
WHERE tarefa."id" = tarefas_ordenadas."id";

ALTER TABLE "tarefas"
  ADD CONSTRAINT "tarefas_duracao_minutos_check"
  CHECK ("duracao_minutos" IS NULL OR "duracao_minutos" BETWEEN 15 AND 10080),
  ADD CONSTRAINT "tarefas_ordem_check"
  CHECK ("ordem" BETWEEN 0 AND 1000000000);

CREATE INDEX "tarefas_empresaId_status_ordem_idx"
  ON "tarefas"("empresaId", "status", "ordem");

CREATE INDEX "tarefas_responsavelId_lembrete_em_lembrete_enviado_em_idx"
  ON "tarefas"("responsavelId", "lembrete_em", "lembrete_enviado_em");

COMMENT ON COLUMN "tarefas"."ordem" IS
  'Posição persistida do card dentro da coluna do cronograma.';

COMMENT ON COLUMN "tarefas"."lembrete_enviado_em" IS
  'Claim atômico que impede o envio duplicado do lembrete.';

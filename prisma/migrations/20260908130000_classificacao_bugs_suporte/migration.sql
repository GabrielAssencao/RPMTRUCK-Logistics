CREATE TYPE "ClassificacaoCobrancaTicket" AS ENUM ('ATENDIMENTO', 'BUG_SISTEMA_CONFIRMADO');

ALTER TABLE "conversas_suporte"
ADD COLUMN "classificacao_cobranca" "ClassificacaoCobrancaTicket" NOT NULL DEFAULT 'ATENDIMENTO',
ADD COLUMN "classificado_em" TIMESTAMP(3),
ADD COLUMN "classificado_por_id" TEXT;

ALTER TABLE "conversas_suporte"
ADD CONSTRAINT "conversas_suporte_classificado_por_id_fkey"
FOREIGN KEY ("classificado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "conversas_suporte_empresaId_competencia_classificacao_cobranca_idx"
ON "conversas_suporte"("empresaId", "competencia", "classificacao_cobranca");

CREATE INDEX "conversas_suporte_classificado_por_id_idx"
ON "conversas_suporte"("classificado_por_id");

-- A nova franquia passa a valer na competência em andamento. O histórico fechado
-- preserva a cobertura que estava vigente quando cada chamado foi criado.
WITH limites AS (
  SELECT
    conversa."id",
    CASE empresa."plano"::text
      WHEN 'ESSENCIAL' THEN 25
      WHEN 'AVANCADO' THEN 35
      WHEN 'ENTERPRISE' THEN 50
      WHEN 'PREVIEW' THEN 50
    END AS limite,
    ROW_NUMBER() OVER (
      PARTITION BY conversa."empresaId", conversa."competencia"
      ORDER BY conversa."criado_em", conversa."id"
    ) AS ordem
  FROM "conversas_suporte" AS conversa
  INNER JOIN "empresas" AS empresa ON empresa."id" = conversa."empresaId"
  WHERE conversa."competencia" = date_trunc('month', timezone('America/Sao_Paulo', now()))::date
)
UPDATE "conversas_suporte" AS conversa
SET
  "franquia_no_momento" = limites.limite,
  "ordem_na_competencia" = limites.ordem,
  "cobravel_extra" = limites.ordem > limites.limite
FROM limites
WHERE conversa."id" = limites."id";

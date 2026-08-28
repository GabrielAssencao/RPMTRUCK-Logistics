CREATE TYPE "CategoriaContaPagar" AS ENUM ('MANUTENCAO');

ALTER TABLE "contas_pagar"
  ADD COLUMN "categoria" "CategoriaContaPagar",
  ADD COLUMN "veiculoId" TEXT,
  ADD COLUMN "historico_veiculo_id" TEXT;

CREATE UNIQUE INDEX "contas_pagar_historico_veiculo_id_key"
  ON "contas_pagar"("historico_veiculo_id");
CREATE INDEX "contas_pagar_empresaId_categoria_vencimento_idx"
  ON "contas_pagar"("empresaId", "categoria", "vencimento");
CREATE INDEX "contas_pagar_veiculoId_idx"
  ON "contas_pagar"("veiculoId");

ALTER TABLE "contas_pagar"
  ADD CONSTRAINT "contas_pagar_veiculoId_fkey"
    FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "contas_pagar_historico_veiculo_id_fkey"
    FOREIGN KEY ("historico_veiculo_id") REFERENCES "historicos_veiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "empresas"
  ALTER COLUMN "modulos" SET DEFAULT ARRAY['FROTA', 'GESTAO', 'CONTAS_PAGAR', 'NOTIFICACOES']::TEXT[];

UPDATE "empresas"
SET "modulos" = array_append("modulos", 'CONTAS_PAGAR')
WHERE 'GESTAO' = ANY("modulos")
  AND NOT ('CONTAS_PAGAR' = ANY("modulos"));

CREATE TABLE "exclusoes_empresa_jobs" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "solicitado_por_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARADO',
  "arquivos" JSONB NOT NULL,
  "erro" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  "concluido_em" TIMESTAMP(3),
  CONSTRAINT "exclusoes_empresa_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exclusoes_empresa_jobs_status_atualizado_em_idx"
  ON "exclusoes_empresa_jobs"("status", "atualizado_em");
CREATE INDEX "exclusoes_empresa_jobs_empresa_id_criado_em_idx"
  ON "exclusoes_empresa_jobs"("empresa_id", "criado_em");

ALTER TABLE "exclusoes_empresa_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "exclusoes_empresa_jobs" FROM anon, authenticated;

COMMENT ON TABLE "exclusoes_empresa_jobs" IS
  'Fila técnica sem FK para concluir limpeza privada de Storage após o expurgo transacional da empresa.';

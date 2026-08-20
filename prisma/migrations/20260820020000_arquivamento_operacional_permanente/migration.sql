-- Registro mínimo e permanente das movimentações de containers.
CREATE TYPE "StatusRelatorioArquivo" AS ENUM (
  'PRONTO_DOWNLOAD',
  'DOWNLOAD_REGISTRADO',
  'CONFIRMADO_GESTOR',
  'DADOS_PURGADOS',
  'ARQUIVO_REMOVIDO'
);

ALTER TABLE "relatorios_arquivados"
ADD COLUMN "status" "StatusRelatorioArquivo" NOT NULL DEFAULT 'PRONTO_DOWNLOAD',
ADD COLUMN "gerado_automaticamente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "resumo_registros" JSONB,
ADD COLUMN "baixadoPorId" TEXT,
ADD COLUMN "baixado_em" TIMESTAMP(3),
ADD COLUMN "confirmadoPorId" TEXT,
ADD COLUMN "confirmado_em" TIMESTAMP(3),
ADD COLUMN "dados_purgados_em" TIMESTAMP(3),
ADD COLUMN "arquivo_removido_em" TIMESTAMP(3);

ALTER TABLE "relatorios_arquivados"
ADD CONSTRAINT "relatorios_arquivados_baixadoPorId_fkey"
FOREIGN KEY ("baixadoPorId") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "relatorios_arquivados"
ADD CONSTRAINT "relatorios_arquivados_confirmadoPorId_fkey"
FOREIGN KEY ("confirmadoPorId") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "containers" ADD COLUMN "relatorioArquivoId" TEXT;
ALTER TABLE "custos" ADD COLUMN "relatorioArquivoId" TEXT;
ALTER TABLE "historicos_veiculo" ADD COLUMN "relatorioArquivoId" TEXT;

CREATE INDEX "containers_relatorioArquivoId_idx" ON "containers"("relatorioArquivoId");
CREATE INDEX "custos_relatorioArquivoId_idx" ON "custos"("relatorioArquivoId");
CREATE INDEX "historicos_veiculo_relatorioArquivoId_idx" ON "historicos_veiculo"("relatorioArquivoId");

ALTER TABLE "containers"
ADD CONSTRAINT "containers_relatorioArquivoId_fkey"
FOREIGN KEY ("relatorioArquivoId") REFERENCES "relatorios_arquivados"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "custos"
ADD CONSTRAINT "custos_relatorioArquivoId_fkey"
FOREIGN KEY ("relatorioArquivoId") REFERENCES "relatorios_arquivados"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "historicos_veiculo"
ADD CONSTRAINT "historicos_veiculo_relatorioArquivoId_fkey"
FOREIGN KEY ("relatorioArquivoId") REFERENCES "relatorios_arquivados"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "movimentacoes_container_permanentes" (
  "id" TEXT NOT NULL,
  "container_origem_id" TEXT NOT NULL,
  "codigo_container" TEXT NOT NULL,
  "terminal_origem" TEXT NOT NULL,
  "terminal_destino" TEXT NOT NULL,
  "data_operacao" TIMESTAMP(3) NOT NULL,
  "empresaId" TEXT NOT NULL,
  "relatorioArquivoId" TEXT,
  "checksum_arquivo" TEXT,
  "arquivado_em" TIMESTAMP(3),
  "detalhes_purgados_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "movimentacoes_container_permanentes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "movimentacoes_container_permanentes_container_origem_id_key"
ON "movimentacoes_container_permanentes"("container_origem_id");

CREATE INDEX "movimentacoes_container_permanentes_empresaId_codigo_container_idx"
ON "movimentacoes_container_permanentes"("empresaId", "codigo_container");

CREATE INDEX "movimentacoes_container_permanentes_empresaId_data_operacao_idx"
ON "movimentacoes_container_permanentes"("empresaId", "data_operacao");

CREATE INDEX "movimentacoes_container_permanentes_relatorioArquivoId_idx"
ON "movimentacoes_container_permanentes"("relatorioArquivoId");

ALTER TABLE "movimentacoes_container_permanentes"
ADD CONSTRAINT "movimentacoes_container_permanentes_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimentacoes_container_permanentes"
ADD CONSTRAINT "movimentacoes_container_permanentes_relatorioArquivoId_fkey"
FOREIGN KEY ("relatorioArquivoId") REFERENCES "relatorios_arquivados"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserva também todas as movimentações já existentes antes desta migração.
INSERT INTO "movimentacoes_container_permanentes" (
  "id",
  "container_origem_id",
  "codigo_container",
  "terminal_origem",
  "terminal_destino",
  "data_operacao",
  "empresaId",
  "criado_em",
  "atualizado_em"
)
SELECT
  "id",
  "id",
  "codigo",
  "terminal_inicio",
  "terminal_fim",
  "data",
  "empresaId",
  "criado_em",
  "atualizado_em"
FROM "containers"
ON CONFLICT ("container_origem_id") DO NOTHING;

-- O mesmo código físico pode participar de operações em datas diferentes.
DROP INDEX IF EXISTS "containers_empresaId_codigo_key";
CREATE UNIQUE INDEX "containers_empresaId_codigo_data_key"
ON "containers"("empresaId", "codigo", "data");

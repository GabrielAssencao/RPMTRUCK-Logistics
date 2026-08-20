-- Padroniza módulos por código estável e registra alterações de acesso da empresa.
ALTER TABLE "empresas"
ADD COLUMN "status_motivo" TEXT,
ADD COLUMN "status_alterado_em" TIMESTAMP(3),
ADD COLUMN "status_alterado_por_id" TEXT;

ALTER TABLE "empresas"
ALTER COLUMN "modulos" SET DEFAULT ARRAY['FROTA', 'GESTAO', 'NOTIFICACOES']::TEXT[];

-- Converte valores legados sem apagar personalizações que já existam.
-- Gestão/notificações passam a ser a base; tarefas entram nos planos que as incluem.
UPDATE "empresas" AS empresa
SET "modulos" = (
  SELECT ARRAY(
    SELECT DISTINCT modulo
    FROM (
      SELECT CASE valor
        WHEN 'FROTA' THEN 'FROTA'
        WHEN 'frota' THEN 'FROTA'
        WHEN 'Módulo Frota' THEN 'FROTA'
        WHEN 'GESTAO' THEN 'GESTAO'
        WHEN 'controle_gestao' THEN 'GESTAO'
        WHEN 'Controle & Gestão' THEN 'GESTAO'
        WHEN 'NOTIFICACOES' THEN 'NOTIFICACOES'
        WHEN 'notificacoes' THEN 'NOTIFICACOES'
        WHEN 'TAREFAS' THEN 'TAREFAS'
        WHEN 'tarefas' THEN 'TAREFAS'
        WHEN 'RELATORIOS' THEN 'RELATORIOS'
        WHEN 'relatorios' THEN 'RELATORIOS'
        WHEN 'Relatórios & Dashboards' THEN 'RELATORIOS'
      END AS modulo
      FROM unnest(COALESCE(empresa."modulos", ARRAY[]::TEXT[])) AS valor

      UNION ALL SELECT 'GESTAO'
      UNION ALL SELECT 'NOTIFICACOES'
      UNION ALL SELECT 'TAREFAS' WHERE empresa."plano" IN ('AVANCADO', 'ENTERPRISE', 'PREVIEW')
      UNION ALL SELECT 'FROTA' WHERE cardinality(COALESCE(empresa."modulos", ARRAY[]::TEXT[])) = 0
      UNION ALL SELECT 'RELATORIOS'
        WHERE cardinality(COALESCE(empresa."modulos", ARRAY[]::TEXT[])) = 0
          AND empresa."plano" IN ('ENTERPRISE', 'PREVIEW')
    ) AS modulos_normalizados
    WHERE modulo IS NOT NULL
    ORDER BY modulo
  )
);

ALTER TABLE "empresas"
ADD CONSTRAINT "empresas_status_alterado_por_id_fkey"
FOREIGN KEY ("status_alterado_por_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "TipoRelatorioArquivo" AS ENUM ('CUSTOS', 'OPERACIONAL', 'PERSONALIZADO');

CREATE TABLE "relatorios_arquivados" (
  "id" TEXT NOT NULL,
  "nome_arquivo" TEXT NOT NULL,
  "caminho_storage" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "tamanho_bytes" INTEGER NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "periodo_inicio" TIMESTAMP(3) NOT NULL,
  "periodo_fim" TIMESTAMP(3) NOT NULL,
  "tipo" "TipoRelatorioArquivo" NOT NULL,
  "empresaId" TEXT NOT NULL,
  "criadoPorId" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "relatorios_arquivados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "relatorios_arquivados_caminho_storage_key"
ON "relatorios_arquivados"("caminho_storage");

CREATE INDEX "relatorios_arquivados_empresaId_criado_em_idx"
ON "relatorios_arquivados"("empresaId", "criado_em");

CREATE INDEX "relatorios_arquivados_empresaId_periodo_inicio_periodo_fim_idx"
ON "relatorios_arquivados"("empresaId", "periodo_inicio", "periodo_fim");

ALTER TABLE "relatorios_arquivados"
ADD CONSTRAINT "relatorios_arquivados_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "relatorios_arquivados"
ADD CONSTRAINT "relatorios_arquivados_criadoPorId_fkey"
FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- No Supabase, o bucket é privado e não possui políticas para acesso direto do cliente.
-- Uploads e URLs assinadas são emitidos exclusivamente pelas APIs autenticadas do servidor.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    ) VALUES (
      'relatorios-privados',
      'relatorios-privados',
      false,
      10485760,
      ARRAY[
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ]::TEXT[]
    )
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

-- Compatibilidade para instalações novas: esta tabela existia em ambientes legados,
-- mas não fazia parte da primeira migration versionada.
CREATE TABLE IF NOT EXISTS "notificacoes" (
  "id" TEXT NOT NULL,
  "modulo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "lida" BOOLEAN NOT NULL DEFAULT false,
  "veiculoId" TEXT,
  "empresaId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notificacoes_veiculoId_fkey"
    FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "notificacoes_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

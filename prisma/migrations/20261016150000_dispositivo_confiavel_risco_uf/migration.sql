ALTER TYPE "EventoSegurancaTipo" ADD VALUE IF NOT EXISTS 'MUDANCA_UF';

ALTER TABLE "dispositivos_confiaveis"
  ADD COLUMN "pais" VARCHAR(2),
  ADD COLUMN "uf" VARCHAR(2),
  ALTER COLUMN "acessos_restantes" SET DEFAULT 5;

UPDATE "dispositivos_confiaveis"
SET "acessos_restantes" = LEAST("acessos_restantes", 5)
WHERE "acessos_restantes" > 5;

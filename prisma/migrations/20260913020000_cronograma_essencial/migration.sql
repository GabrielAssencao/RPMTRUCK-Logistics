-- Add personal scheduling for existing Essential companies; preserve user permissions.
UPDATE "empresas" SET "modulos" = array_append("modulos", 'TAREFAS')
WHERE "plano" = 'ESSENCIAL' AND NOT ('TAREFAS' = ANY("modulos"));

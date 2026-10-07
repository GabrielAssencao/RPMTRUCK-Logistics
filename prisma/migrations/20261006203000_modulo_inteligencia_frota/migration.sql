ALTER TABLE "empresas"
ALTER COLUMN "modulos" SET DEFAULT ARRAY['FROTA', 'GESTAO', 'INTELIGENCIA', 'CONTAS_PAGAR', 'NOTIFICACOES', 'TAREFAS']::TEXT[];

-- Mantém a funcionalidade já disponibilizada para empresas com Frota e Gestão.
-- O SuperAdmin pode removê-la individualmente depois da migração.
UPDATE "empresas"
SET "modulos" = array_append("modulos", 'INTELIGENCIA')
WHERE 'FROTA' = ANY("modulos")
  AND 'GESTAO' = ANY("modulos")
  AND NOT ('INTELIGENCIA' = ANY("modulos"));

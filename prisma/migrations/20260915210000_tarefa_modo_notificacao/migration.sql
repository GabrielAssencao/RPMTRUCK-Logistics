ALTER TABLE "tarefas"
ADD COLUMN "modo_notificacao" TEXT NOT NULL DEFAULT 'PERSONALIZADA';

ALTER TABLE "tarefas"
ALTER COLUMN "modo_notificacao" SET DEFAULT 'AUTOMATICA';

ALTER TABLE "tarefas"
ADD CONSTRAINT "tarefas_modo_notificacao_check"
CHECK ("modo_notificacao" IN ('AUTOMATICA', 'PERSONALIZADA'));

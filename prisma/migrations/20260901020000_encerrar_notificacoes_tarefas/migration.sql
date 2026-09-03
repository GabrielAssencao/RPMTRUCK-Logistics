-- Notificações de atribuição antigas não devem continuar como pendência
-- depois que a tarefa vinculada já foi encerrada.
UPDATE "notificacoes" AS notificacao
SET "lida" = true
FROM "tarefas" AS tarefa
WHERE notificacao."tarefaId" = tarefa."id"
  AND notificacao."lida" = false
  AND tarefa."status" IN ('CONCLUIDA', 'CANCELADA');

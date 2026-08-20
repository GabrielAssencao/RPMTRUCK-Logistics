-- Alterações aditivas: preservam empresas, usuários e dados operacionais existentes.
ALTER TABLE "empresas" ADD COLUMN "telefone" TEXT;

ALTER TABLE "motoristas"
  ADD COLUMN "cpf" TEXT,
  ADD COLUMN "rg" TEXT,
  ADD COLUMN "foto_url" TEXT;

CREATE UNIQUE INDEX "motoristas_empresaId_cpf_key"
  ON "motoristas"("empresaId", "cpf");
CREATE UNIQUE INDEX "motoristas_empresaId_cnh_key"
  ON "motoristas"("empresaId", "cnh");

CREATE TABLE "tarefas" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "prazo" TIMESTAMP(3),
  "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "modulo" TEXT,
  "origem_id" TEXT,
  "empresaId" TEXT NOT NULL,
  "criadorId" TEXT NOT NULL,
  "responsavelId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  "concluido_em" TIMESTAMP(3),
  CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tarefas_prioridade_check" CHECK ("prioridade" IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
  CONSTRAINT "tarefas_status_check" CHECK ("status" IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  CONSTRAINT "tarefas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tarefas_criadorId_fkey" FOREIGN KEY ("criadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "tarefas_empresaId_status_prazo_idx" ON "tarefas"("empresaId", "status", "prazo");
CREATE INDEX "tarefas_responsavelId_status_prazo_idx" ON "tarefas"("responsavelId", "status", "prazo");

ALTER TABLE "notificacoes"
  ALTER COLUMN "empresaId" DROP NOT NULL,
  ADD COLUMN "usuarioId" TEXT,
  ADD COLUMN "tarefaId" TEXT;

ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notificacoes_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "notificacoes_destino_check" CHECK ("empresaId" IS NOT NULL OR "usuarioId" IS NOT NULL);

CREATE INDEX "notificacoes_usuarioId_lida_criado_em_idx" ON "notificacoes"("usuarioId", "lida", "criado_em");
CREATE INDEX "notificacoes_empresaId_lida_criado_em_idx" ON "notificacoes"("empresaId", "lida", "criado_em");

CREATE TABLE "containers" (
  "id" TEXT NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "codigo" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "terminal_inicio" TEXT NOT NULL,
  "terminal_fim" TEXT NOT NULL,
  "frete" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "comissao" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'AGENDADO',
  "observacoes" TEXT,
  "itens_conteudo" JSONB,
  "empresaId" TEXT NOT NULL,
  "veiculoId" TEXT NOT NULL,
  "motoristaId" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "containers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "containers_status_check" CHECK ("status" IN ('AGENDADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO')),
  CONSTRAINT "containers_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "containers_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "containers_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "containers_empresaId_codigo_key" ON "containers"("empresaId", "codigo");
CREATE INDEX "containers_empresaId_data_status_idx" ON "containers"("empresaId", "data", "status");

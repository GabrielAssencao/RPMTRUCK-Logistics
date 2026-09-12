CREATE TABLE "lembretes_pessoais" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "data_hora" TIMESTAMP(3) NOT NULL,
  "urgencia" TEXT NOT NULL DEFAULT 'MEDIA',
  "modo_notificacao" TEXT NOT NULL DEFAULT 'AUTOMATICA',
  "notificar_em" TIMESTAMP(3) NOT NULL,
  "notificacao_enviada_em" TIMESTAMP(3),
  "concluido" BOOLEAN NOT NULL DEFAULT false,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "empresaId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lembretes_pessoais_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lembretes_pessoais_urgencia_check" CHECK ("urgencia" IN ('LEVE', 'MEDIA', 'ALTA')),
  CONSTRAINT "lembretes_pessoais_modo_notificacao_check" CHECK ("modo_notificacao" IN ('AUTOMATICA', 'PERSONALIZADA')),
  CONSTRAINT "lembretes_pessoais_ordem_check" CHECK ("ordem" BETWEEN 0 AND 1000000000)
);

CREATE INDEX "lembretes_pessoais_empresaId_usuarioId_concluido_ordem_idx"
  ON "lembretes_pessoais"("empresaId", "usuarioId", "concluido", "ordem");

CREATE INDEX "lembretes_pessoais_usuarioId_notificar_em_notificacao_enviada_em_idx"
  ON "lembretes_pessoais"("usuarioId", "notificar_em", "notificacao_enviada_em");

ALTER TABLE "lembretes_pessoais"
  ADD CONSTRAINT "lembretes_pessoais_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "lembretes_pessoais_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notificacoes"
  ADD COLUMN "lembrete_pessoal_id" TEXT;

CREATE INDEX "notificacoes_lembrete_pessoal_id_idx"
  ON "notificacoes"("lembrete_pessoal_id");

ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_lembrete_pessoal_id_fkey"
  FOREIGN KEY ("lembrete_pessoal_id") REFERENCES "lembretes_pessoais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

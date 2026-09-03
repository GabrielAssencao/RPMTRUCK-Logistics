-- Chat privado entre o gestor de cada empresa e o time administrador.
CREATE TABLE "conversas_suporte" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversas_suporte_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversas_suporte_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "conversas_suporte_empresaId_key" ON "conversas_suporte"("empresaId");
CREATE INDEX "conversas_suporte_atualizado_em_idx" ON "conversas_suporte"("atualizado_em");

CREATE TABLE "mensagens_suporte" (
  "id" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "lida_em" TIMESTAMP(3),
  "conversaId" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensagens_suporte_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mensagens_suporte_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas_suporte"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mensagens_suporte_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mensagens_suporte_conteudo_check" CHECK (char_length(btrim("conteudo")) BETWEEN 1 AND 2000)
);

CREATE INDEX "mensagens_suporte_conversaId_criado_em_idx" ON "mensagens_suporte"("conversaId", "criado_em");
CREATE INDEX "mensagens_suporte_conversaId_lida_em_idx" ON "mensagens_suporte"("conversaId", "lida_em");

CREATE TYPE "AlertaSeveridade" AS ENUM ('INFORMACAO', 'AVISO', 'CRITICO');

CREATE TABLE "alertas_sistema" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "severidade" "AlertaSeveridade" NOT NULL DEFAULT 'INFORMACAO',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "inicio_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fim_em" TIMESTAMP(3),
  "destinatarioId" TEXT,
  "criadoPorId" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alertas_sistema_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alertas_sistema_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "alertas_sistema_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "alertas_sistema_periodo_check" CHECK ("fim_em" IS NULL OR "fim_em" > "inicio_em"),
  CONSTRAINT "alertas_sistema_titulo_check" CHECK (char_length(btrim("titulo")) BETWEEN 3 AND 120),
  CONSTRAINT "alertas_sistema_mensagem_check" CHECK (char_length(btrim("mensagem")) BETWEEN 3 AND 2000)
);

CREATE INDEX "alertas_sistema_ativo_inicio_em_fim_em_idx" ON "alertas_sistema"("ativo", "inicio_em", "fim_em");
CREATE INDEX "alertas_sistema_destinatarioId_ativo_inicio_em_idx" ON "alertas_sistema"("destinatarioId", "ativo", "inicio_em");

CREATE TABLE "alertas_leituras" (
  "alertaId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "lido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alertas_leituras_pkey" PRIMARY KEY ("alertaId", "usuarioId"),
  CONSTRAINT "alertas_leituras_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas_sistema"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "alertas_leituras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "alertas_leituras_usuarioId_lido_em_idx" ON "alertas_leituras"("usuarioId", "lido_em");

-- O conteúdo do chat não entra em snapshots de auditoria. Alterações administrativas
-- nos alertas são auditadas, pois afetam a comunicação de toda a plataforma.
CREATE TRIGGER "auditar_alertas_sistema"
AFTER INSERT OR UPDATE OR DELETE ON public."alertas_sistema"
FOR EACH ROW EXECUTE FUNCTION public.rpm_auditar_mutacao();

-- A Data API está desativada, mas mantemos defesa em profundidade caso seja reativada.
REVOKE ALL ON TABLE "conversas_suporte", "mensagens_suporte", "alertas_sistema", "alertas_leituras" FROM anon, authenticated;

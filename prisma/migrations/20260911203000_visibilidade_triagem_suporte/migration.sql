CREATE TYPE "VisibilidadeMensagemSuporte" AS ENUM ('TODOS', 'ADMIN');

ALTER TABLE "mensagens_suporte"
ADD COLUMN "visibilidade" "VisibilidadeMensagemSuporte" NOT NULL DEFAULT 'TODOS';

ALTER TABLE "conversas_suporte"
ADD COLUMN "etapa_triagem" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "triagem_concluida_em" TIMESTAMP(3);

CREATE INDEX "mensagens_suporte_conversaId_visibilidade_criado_em_idx"
ON "mensagens_suporte"("conversaId", "visibilidade", "criado_em");
